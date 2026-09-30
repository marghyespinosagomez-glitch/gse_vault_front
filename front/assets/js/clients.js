document.addEventListener('DOMContentLoaded', () => {
    // Guard: esta pantalla requiere sesion activa
    if (!getToken()) {
        window.location.href = './login.html';
        return;
    }
    const currentUser = JSON.parse(sessionStorage.getItem(USER_KEY) || '{}');
    console.log('currentUser:', currentUser);

    const modalAlert = document.getElementById('modal-alert');
    const searchInput = document.getElementById('search-input');
    const tbody = document.getElementById('clients-tbody');
    const emptyState = document.getElementById('empty-state');

    const modalOverlay = document.getElementById('modal-overlay');
    const btnOpenModal = document.getElementById('btn-open-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const createForm = document.getElementById('create-client-form');
    const submitBtn = document.getElementById('btn-submit-client');

    const linkLogout = document.getElementById('link-logout');
    const navAdmins = document.getElementById('nav-admins');

    let editingClient = null;
    const isAdmin = currentUser.rol === 'admin' && !currentUser.visual;
    const isViewOnly = currentUser.rol === 'admin' && currentUser.visual === true;

    if (!isAdmin) {
        btnOpenModal.style.display = 'none';
    }
    if (isAdmin || isViewOnly) {
        if (navAdmins) navAdmins.style.display = 'flex';
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

    let clients = [];

    // ---------- Carga de clientes reales ----------
    // Admin/admin visual: POST /logic/getClientByRol (rol=cliente) via proxy, ven a todos los clientes.
    // Un rol "cliente" solo consulta su propio registro (POST /logic/getClientByUuid via proxy).
    async function fetchRemoteClients() {
        try {
            const path = currentUser.rol === 'cliente' ? '/clients/by-uuid' : '/clients/by-role?rol=cliente';
            const data = await apiFetch(path, { method: 'GET' });
            console.log('data recibida en el front:', data);
            return Array.isArray(data.clientes) ? data.clientes : [];
        } catch (error) {
            showResultModal(`No se pudo cargar la lista de clientes: ${error.message}`, 'danger', 'Error al cargar clientes');
            return [];
        }
    }

    // ---------- Persistencia local de clientes creados desde este navegador ----------
    function loadLocalClients() {
        try {
            const raw = sessionStorage.getItem(CLIENTS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveLocalClients(localClients) {
        sessionStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(localClients));
    }

    // ---------- Helpers de campos (el servicio externo no siempre envia los mismos campos) ----------
    function getDisplayName(client) {
        return client.nameApp || client.nombre || (client.uuid ? `Cliente ${client.uuid.slice(0, 8)}` : 'Sin nombre');
    }

    function getDisplayEmail(client) {
        return client.email || client.correo || '-';
    }

    // ---------- Busqueda difusa (Levenshtein compartido en config.js) ----------
    // Similitud 0-1 (1 = coincidencia exacta) tomando el mejor resultado entre nombre y correo
    function bestSimilarity(query, client) {
        return bestSimilarityAmong(query, [getDisplayName(client), getDisplayEmail(client)]);
    }

    // ---------- Render ----------
    function renderTable() {
        const query = searchInput.value.trim();
        let rows = clients.map((client) => ({ client, score: query ? bestSimilarity(query, client) : null }));

        if (query) {
            // Solo muestra coincidencias razonables, ordenadas de mas a menos parecidas
            rows = rows.filter((row) => row.score > 0.3).sort((a, b) => b.score - a.score);
        }

        tbody.innerHTML = '';
        emptyState.style.display = rows.length === 0 ? 'block' : 'none';

        rows.forEach((row, index) => {
            const tr = document.createElement('tr');
            if (query && index === 0) tr.classList.add('best-match');

            const typeAuth = row.client.typeAuth || 'simple';
            const typeAuthClass = ['simple', 'auth'].includes(typeAuth) ? typeAuth : 'other';

            tr.innerHTML = `
                <td class="client-name">${escapeHtml(getDisplayName(row.client))}</td>
                <td>${escapeHtml(getDisplayEmail(row.client))}</td>
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
            tr.dataset.uuid = row.client.uuid;
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
            // Cierra cualquier otro menú abierto
            document.querySelectorAll('.dropdown-menu.show').forEach((m) => {
                if (m !== menu) m.classList.remove('show');
            });
            menu.classList.toggle('show');
            return;
        }

        if (editBtn) {
            const tr = editBtn.closest('tr');
            const uuid = tr.dataset.uuid;
            const client = clients.find((c) => c.uuid === uuid);
            if (client) openEditModal(client);
            editBtn.closest('.dropdown-menu').classList.remove('show');
        }
    });
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.actions-cell')) {
            document.querySelectorAll('.dropdown-menu.show').forEach((m) => m.classList.remove('show'));
        }
    });

    // ---------- Modal de edicion / visualizacion ----------
    function openEditModal(client) {
        editingClient = client;
        modalOverlay.classList.add('show');
        hideAlert(modalAlert);
        createForm.reset();

        // Pinta los datos actuales
        document.getElementById('client-nombre').value = getDisplayName(client);
        document.getElementById('client-correo').value = getDisplayEmail(client);
        document.getElementById('client-typeauth').value = client.typeAuth || 'simple';

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
        if (isEdit) {
            passRequirements.style.display = 'none';
        } else {
            passRequirements.style.display = '';
        }

        // En modo solo lectura no se puede guardar nada: el boton de enviar no debe aparecer
        submitBtn.style.display = readOnly ? 'none' : '';
        submitBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear cliente';
        document.getElementById('modal-title').textContent = readOnly ? 'Ver cliente' : isEdit ? 'Editar cliente' : 'Crear cliente';
    }


    // ---------- Crear cliente ----------
    // Schema real esperado por el servicio externo: { uuid, email, nameApp, typeAuth, pass }
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
            // ---------- Modo edición ----------
            submitBtn.textContent = 'Guardando...';
            try {
                await apiFetch('/clients/update', {
                    method: 'POST',
                    body: JSON.stringify({ uuid: editingClient.uuid, nameApp, typeAuth })
                });
                // Refleja el cambio localmente sin esperar a recargar toda la lista
                const idx = clients.findIndex((c) => c.uuid === editingClient.uuid);
                if (idx !== -1) clients[idx] = { ...clients[idx], nameApp, typeAuth };
                clearCachedClients();
                renderTable();
                closeModal();
                showResultModal(`El cliente ${nameApp} se actualizó correctamente.`, 'success', 'Cliente actualizado');
            } catch (error) {
                closeModal();
                showResultModal(`No se pudo actualizar el cliente: ${error.message}`, 'danger', 'Error al actualizar');
            }
            submitBtn.disabled = false;
            return;
        }

        // ---------- Modo creación ----------
        // Esta pantalla solo administra clientes; los administradores se crean en Administradores
        const email = document.getElementById('client-correo').value.trim();
        const pass = document.getElementById('client-pass').value;
        const rol = 'cliente';

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
        const clientData = { uuid: crypto.randomUUID(), email, nameApp, typeAuth, pass, rol };
        let newClient = { uuid: clientData.uuid, email, nameApp, typeAuth, rol };
        let synced = false;
        let syncError = '';

        try {
            const data = await apiFetch('/clients/create', {
                method: 'POST',
                body: JSON.stringify(clientData)
            });
            const { pass: _discardPass, ...createdClient } = data.newClient || data;
            newClient = { ...newClient, ...createdClient };
            synced = true;
            clearCachedClients();
        } catch (error) {
            syncError = error.message;
        }

        clients.unshift(newClient);
        if (!synced) {
            const localClients = loadLocalClients();
            localClients.unshift(newClient);
            saveLocalClients(localClients);
        }

        renderTable();
        closeModal();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear cliente';

        if (synced) {
            showResultModal(`El cliente ${nameApp} se creó correctamente.`, 'success', 'Cliente creado');
        } else {
            showResultModal(
                `El cliente se agregó a la tabla, pero no se pudo sincronizar con el servicio externo: ${syncError}`,
                'danger',
                'Error al crear el cliente'
            );
        }
    });

    linkLogout.addEventListener('click', (event) => {
        event.preventDefault();
        clearSession();
        window.location.href = './login.html';
    });

    // ---------- Carga inicial: clientes reales + los creados localmente que aun no esten en la lista remota ----------
    (async function init() {
        const remoteClients = await fetchRemoteClients();
        const localClients = loadLocalClients();
        const remoteUuids = new Set(remoteClients.map((c) => c.uuid).filter(Boolean));
        const remoteEmails = new Set(remoteClients.map((c) => (c.email || '').toLowerCase()).filter(Boolean));

        // Un local ya esta "confirmado" si su uuid o su correo aparecen en el listado remoto
        const isConfirmedRemote = (c) =>
            (c.uuid && remoteUuids.has(c.uuid)) || (c.email && remoteEmails.has(c.email.toLowerCase()));

        const pendingLocalClients = localClients.filter((c) => !isConfirmedRemote(c));

        // Limpia sessionStorage de entradas ya confirmadas para que no vuelvan a duplicarse
        if (pendingLocalClients.length !== localClients.length) {
            saveLocalClients(pendingLocalClients);
        }

        clients = [...pendingLocalClients, ...remoteClients];
        renderTable();
    })();
});
