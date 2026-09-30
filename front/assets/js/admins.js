document.addEventListener('DOMContentLoaded', () => {
    // Guard: esta pantalla requiere sesion activa y rol admin (editor o visual)
    if (!getToken()) {
        window.location.href = './login.html';
        return;
    }
    const currentUser = JSON.parse(sessionStorage.getItem(USER_KEY) || '{}');
    const isAdmin = currentUser.rol === 'admin' && !currentUser.visual;
    const isViewOnly = currentUser.rol === 'admin' && currentUser.visual === true;

    if (!isAdmin && !isViewOnly) {
        window.location.href = './clients.html';
        return;
    }

    const modalAlert = document.getElementById('modal-alert');
    const searchInput = document.getElementById('search-input');
    const tbody = document.getElementById('clients-tbody');
    const emptyState = document.getElementById('empty-state');

    const modalOverlay = document.getElementById('modal-overlay');
    const btnOpenModal = document.getElementById('btn-open-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const createForm = document.getElementById('create-client-form');
    const submitBtn = document.getElementById('btn-submit-client');
    const adminModeSelect = document.getElementById('client-admin-mode');

    const linkLogout = document.getElementById('link-logout');

    let editingClient = null;

    if (!isAdmin) {
        btnOpenModal.style.display = 'none';
    }

    // Payload enviado al servicio externo: rol siempre 'admin'; visual:true solo para el visualizador
    function getAdminRoleFields() {
        return adminModeSelect.value === 'visualizador' ? { rol: 'admin', visual: true } : { rol: 'admin' };
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Minimo 8 caracteres, con mayuscula, minuscula, numero y simbolo
    const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]).{8,}$/;
    const PASSWORD_RULES = {
        length: (value) => value.length >= 8,
        upper: (value) => /[A-Z]/.test(value),
        lower: (value) => /[a-z]/.test(value),
        number: (value) => /\d/.test(value),
        symbol: (value) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(value)
    };

    const passInput = document.getElementById('client-pass');
    const passRequirements = document.getElementById('client-pass-requirements');
    const correoInput = document.getElementById('client-correo');
    const correoFeedback = document.getElementById('client-correo-feedback');

    // ---------- Feedback en vivo de validez del correo ----------
    function updateCorreoFeedback() {
        const value = correoInput.value.trim();
        if (!value) {
            correoFeedback.textContent = '';
            correoFeedback.classList.remove('hint-invalid', 'hint-valid');
            return;
        }
        const isValid = EMAIL_REGEX.test(value);
        correoFeedback.textContent = isValid ? 'Correo valido' : 'Correo no valido';
        correoFeedback.classList.toggle('hint-invalid', !isValid);
        correoFeedback.classList.toggle('hint-valid', isValid);
    }

    correoInput.addEventListener('input', updateCorreoFeedback);

    // ---------- Checklist en vivo de requisitos de contrasena ----------
    function updatePasswordRequirements() {
        const value = passInput.value;
        passRequirements.querySelectorAll('li[data-rule]').forEach((li) => {
            const passes = PASSWORD_RULES[li.dataset.rule](value);
            li.classList.toggle('req-ok', passes);
            li.classList.toggle('req-fail', !passes);
        });
    }

    passInput.addEventListener('input', updatePasswordRequirements);

    let admins = [];

    // ---------- Carga de administradores reales (POST /logic/getClientByRol via proxy del backend) ----------
    async function fetchRemoteAdmins() {
        try {
            const data = await apiFetch('/clients/by-role?rol=admin', { method: 'GET' });
            return Array.isArray(data.clientes) ? data.clientes : [];
        } catch (error) {
            showResultModal(`No se pudo cargar la lista de administradores: ${error.message}`, 'danger', 'Error al cargar administradores');
            return [];
        }
    }

    // ---------- Helpers de campos ----------
    function getDisplayName(admin) {
        return admin.nameApp || admin.nombre || (admin.uuid ? `Admin ${admin.uuid.slice(0, 8)}` : 'Sin nombre');
    }

    function getDisplayEmail(admin) {
        return admin.email || admin.correo || '-';
    }

    function getAdminModeLabel(admin) {
        return admin.visual === true ? 'Visualizador' : 'Editor';
    }

    // ---------- Busqueda difusa (Levenshtein compartido en config.js) ----------
    function bestSimilarity(query, admin) {
        return bestSimilarityAmong(query, [getDisplayName(admin), getDisplayEmail(admin)]);
    }

    // ---------- Render ----------
    function renderTable() {
        const query = searchInput.value.trim();
        let rows = admins.map((admin) => ({ admin, score: query ? bestSimilarity(query, admin) : null }));

        if (query) {
            rows = rows.filter((row) => row.score > 0.3).sort((a, b) => b.score - a.score);
        }

        tbody.innerHTML = '';
        emptyState.style.display = rows.length === 0 ? 'block' : 'none';

        rows.forEach((row, index) => {
            const tr = document.createElement('tr');
            if (query && index === 0) tr.classList.add('best-match');

            const typeAuth = row.admin.typeAuth || 'simple';
            const typeAuthClass = ['simple', 'auth'].includes(typeAuth) ? typeAuth : 'other';
            const modeLabel = getAdminModeLabel(row.admin);
            const modeClass = modeLabel === 'Visualizador' ? 'other' : 'auth';

            tr.innerHTML = `
                <td class="client-name">${escapeHtml(getDisplayName(row.admin))}</td>
                <td>${escapeHtml(getDisplayEmail(row.admin))}</td>
                <td><span class="badge-typeauth ${modeClass}">${escapeHtml(modeLabel)}</span></td>
                <td><span class="badge-typeauth ${typeAuthClass}">${escapeHtml(typeAuth)}</span></td>
                 <td class="actions-cell">
                    <button class="btn-dots" data-action="toggle-menu">⋮</button>
                    <div class="dropdown-menu">
                        <button data-action="edit">
                          ${isViewOnly
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'}
                          ${isViewOnly ? 'Ver' : 'Editar'}
                        </button>
                    </div>
                 </td>
            `;
            tr.dataset.uuid = row.admin.uuid;
            tbody.appendChild(tr);
        });
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    }

    searchInput.addEventListener('input', renderTable);

    // ---------- Modal ----------
    function openModal() {
        editingClient = null;
        modalOverlay.classList.add('show');
        hideAlert(modalAlert);
        createForm.reset();
        updatePasswordRequirements();
        updateCorreoFeedback();
        setFormMode('create');
    }

    function closeModal() {
        modalOverlay.classList.remove('show');
    }

    btnOpenModal.addEventListener('click', openModal);
    btnCloseModal.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) closeModal();
    });

    tbody.addEventListener('click', (event) => {
        const dotsBtn = event.target.closest('[data-action="toggle-menu"]');
        const editBtn = event.target.closest('[data-action="edit"]');

        if (dotsBtn) {
            const menu = dotsBtn.nextElementSibling;
            document.querySelectorAll('.dropdown-menu.show').forEach((m) => {
                if (m !== menu) m.classList.remove('show');
            });
            menu.classList.toggle('show');
            return;
        }

        if (editBtn) {
            const tr = editBtn.closest('tr');
            const uuid = tr.dataset.uuid;
            const admin = admins.find((a) => a.uuid === uuid);
            if (admin) openEditModal(admin);
            editBtn.closest('.dropdown-menu').classList.remove('show');
        }
    });
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.actions-cell')) {
            document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));
        }
    });

    // ---------- Modal de edicion / visualizacion ----------
    function openEditModal(admin) {
        editingClient = admin;
        modalOverlay.classList.add('show');
        hideAlert(modalAlert);
        createForm.reset();

        document.getElementById('client-nombre').value = getDisplayName(admin);
        document.getElementById('client-correo').value = getDisplayEmail(admin);
        document.getElementById('client-typeauth').value = admin.typeAuth || 'simple';
        adminModeSelect.value = admin.visual === true ? 'visualizador' : 'editor';

        setFormMode('edit', isViewOnly);
    }

    function setFormMode(mode, readOnly = false) {
        const isEdit = mode === 'edit';
        const nombreInput = document.getElementById('client-nombre');
        const correoInput = document.getElementById('client-correo');
        const passInput = document.getElementById('client-pass');
        const typeAuthInput = document.getElementById('client-typeauth');

        // Solo nombre y typeAuth son editables; el resto se bloquea. En modo lectura, todo se bloquea.
        nombreInput.disabled = readOnly;
        typeAuthInput.disabled = readOnly;
        correoInput.disabled = isEdit || readOnly;
        passInput.disabled = isEdit || readOnly;
        passInput.required = !isEdit;
        adminModeSelect.disabled = isEdit || readOnly;
        if (isEdit) {
            passRequirements.style.display = 'none';
        } else {
            passRequirements.style.display = '';
        }

        // En modo solo lectura no se puede guardar nada: el boton de enviar no debe aparecer
        submitBtn.style.display = readOnly ? 'none' : '';
        submitBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear administrador';
        document.getElementById('modal-title').textContent = readOnly
            ? 'Ver administrador'
            : isEdit ? 'Editar administrador' : 'Crear administrador';
    }

    // ---------- Crear administrador ----------
    // Schema real esperado por el servicio externo: { uuid, email, nameApp, typeAuth, pass, rol }
    createForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideAlert(modalAlert);

        const nameApp = document.getElementById('client-nombre').value.trim();
        const typeAuth = document.getElementById('client-typeauth').value;

        if (!nameApp) {
            showAlert(modalAlert, 'El nombre es obligatorio');
            return;
        }

        submitBtn.disabled = true;

        if (editingClient) {
            // ---------- Modo edicion ----------
            submitBtn.textContent = 'Guardando...';
            try {
                await apiFetch('/clients/update', {
                    method: 'POST',
                    body: JSON.stringify({ uuid: editingClient.uuid, nameApp, typeAuth })
                });
                const idx = admins.findIndex((a) => a.uuid === editingClient.uuid);
                if (idx !== -1) admins[idx] = { ...admins[idx], nameApp, typeAuth };
                clearCachedClients();
                renderTable();
                closeModal();
                showResultModal(`El administrador ${nameApp} se actualizó correctamente.`, 'success', 'Administrador actualizado');
            } catch (error) {
                closeModal();
                showResultModal(`No se pudo actualizar el administrador: ${error.message}`, 'danger', 'Error al actualizar');
            }
            submitBtn.disabled = false;
            return;
        }

        // ---------- Modo creacion ----------
        const email = document.getElementById('client-correo').value.trim();
        const pass = document.getElementById('client-pass').value;
        const { rol, visual } = getAdminRoleFields();

        if (!EMAIL_REGEX.test(email)) {
            showAlert(modalAlert, 'El correo no es valido');
            submitBtn.disabled = false;
            return;
        }
        if (!PASSWORD_REGEX.test(pass)) {
            showAlert(modalAlert, 'La contrasena debe tener minimo 8 caracteres, con mayuscula, minuscula, numero y simbolo');
            submitBtn.disabled = false;
            return;
        }

        submitBtn.textContent = 'Creando...';
        const clientData = { uuid: crypto.randomUUID(), email, nameApp, typeAuth, pass, rol, ...(visual ? { visual } : {}) };
        let newAdmin = { uuid: clientData.uuid, email, nameApp, typeAuth, rol, visual: Boolean(visual) };
        let synced = false;
        let syncError = '';

        try {
            const data = await apiFetch('/clients/create', {
                method: 'POST',
                body: JSON.stringify(clientData)
            });
            const { pass: _discardPass, ...createdAdmin } = data.newClient || data;
            newAdmin = { ...newAdmin, ...createdAdmin };
            synced = true;
            clearCachedClients();
        } catch (error) {
            syncError = error.message;
        }

        if (synced) admins.unshift(newAdmin);

        renderTable();
        closeModal();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear administrador';

        if (synced) {
            showResultModal(`El administrador ${nameApp} se creó correctamente.`, 'success', 'Administrador creado');
        } else {
            showResultModal(`No se pudo crear el administrador: ${syncError}`, 'danger', 'Error al crear el administrador');
        }
    });

    linkLogout.addEventListener('click', (event) => {
        event.preventDefault();
        clearSession();
        window.location.href = './login.html';
    });

    // ---------- Carga inicial ----------
    (async function init() {
        admins = await fetchRemoteAdmins();
        renderTable();
    })();
});
