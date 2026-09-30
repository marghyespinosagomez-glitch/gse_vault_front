document.addEventListener('DOMContentLoaded', () => {
    // Guard: esta pantalla requiere sesion activa
    if (!getToken()) {
        window.location.href = './login.html';
        return;
    }

    const currentUser = JSON.parse(sessionStorage.getItem(USER_KEY) || '{}');
    const isAdmin = currentUser.rol === 'admin' && !currentUser.visual;
    const isViewOnly = currentUser.rol === 'admin' && currentUser.visual === true;
    const canViewAllClients = isAdmin || isViewOnly;
    const ownUuid = currentUser.uuid;

    const modalAlert = document.getElementById('modal-alert');
    const searchInput = document.getElementById('search-input');
    const tbody = document.getElementById('keys-tbody');
    const emptyState = document.getElementById('empty-state');

    const clientColumn = document.querySelector('.col-client');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const btnClearDateFilter = document.getElementById('btn-clear-date-filter');

    const modalOverlay = document.getElementById('modal-overlay');
    const btnOpenModal = document.getElementById('btn-open-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const createForm = document.getElementById('create-key-form');
    const submitBtn = document.getElementById('btn-submit-key');

    const keyClientGroup = document.getElementById('key-client-group');
    const keyClientSelect = document.getElementById('key-client');
    const algorithmSelect = document.getElementById('key-algorithm');
    const pvkeyInput = document.getElementById('key-pvkey');
    const pvkeyFeedback = document.getElementById('key-pvkey-feedback');
    const btnGenerateKey = document.getElementById('btn-generate-key');
    const dynamicCheckbox = document.getElementById('key-dynamic');
    const dynamicFields = document.getElementById('dynamic-fields');

    const linkLogout = document.getElementById('link-logout');
    const navAdmins = document.getElementById('nav-admins');

    // Longitud exacta que exige cada algoritmo simetrico
    const KEY_LENGTH_BY_ALGORITHM = { '3DES': 24, AES: 32 };
    const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let keys = [];
    let clients = [];

    if (canViewAllClients) {
        clientColumn.style.display = '';
    }
    if (isAdmin) {
        keyClientGroup.style.display = 'block';
    }
    if (isViewOnly) {
        btnOpenModal.style.display = 'none';
    }
    if (isAdmin || isViewOnly) {
        if (navAdmins) navAdmins.style.display = 'flex';
    }

    // ---------- Helpers ----------
    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    }

    // Intenta parsear fechas en formatos no ISO (ej. dd/mm/yyyy) ademas de lo que ya entiende Date()
    function parseFlexibleDate(value) {
        if (value === undefined || value === null || value === '') return null;

        if (typeof value === 'number') {
            // Algunos backends envian epoch en segundos en vez de milisegundos
            const asMs = value < 1e12 ? value * 1000 : value;
            const fromNumber = new Date(asMs);
            return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
        }

        const direct = new Date(value);
        if (!Number.isNaN(direct.getTime())) return direct;

        const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(value).trim());
        if (match) {
            const [, day, month, year, hour = '0', minute = '0', second = '0'] = match;
            const fromParts = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
            return Number.isNaN(fromParts.getTime()) ? null : fromParts;
        }

        return null;
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = parseFlexibleDate(value);
        return date ? date.toLocaleString('es-CO') : escapeHtml(value);
    }

    function toIsoOrUndefined(value) {
        if (!value) return undefined;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    function getClientName(idClient) {
        const client = clients.find((c) => c.uuid === idClient);
        return client ? client.nameApp || client.nombre || client.email || idClient : idClient || '-';
    }

    // El servicio externo no siempre usa el mismo nombre para la fecha de creacion
    function getCreatedAt(key) {
        const known =
            key.createdAt || key.created_at || key.fechaCreacion || key.createDate || key.fecha ||
            key.creationDate || key.dateCreated || key.createdOn || key.registeredAt;
        if (known) return known;

        // Fallback: cualquier campo cuyo nombre sugiera fecha de creacion/alta
        const entry = Object.entries(key).find(([fieldName]) => /creat|alta|registr/i.test(fieldName));
        return entry ? entry[1] : null;
    }

    // Usa el estado que reporte el servicio externo y, si no viene, lo deduce de la vigencia
    function getKeyStatus(key) {
        const reported = key.state ?? key.status ?? key.estado ?? key.active ?? key.enabled ?? key.activo;

        if (typeof reported === 'boolean') {
            return reported
                ? { label: 'Habilitada', variant: 'success' }
                : { label: 'Inhabilitada', variant: 'danger' };
        }

        if (typeof reported === 'string' && reported.trim()) {
            const normalized = reported.trim().toLowerCase();
            if (normalized === 'true') return { label: 'Habilitada', variant: 'success' };
            if (normalized === 'false') return { label: 'Inhabilitada', variant: 'danger' };
            const isOk = ['activa', 'active', 'activo', 'ok', 'valid', 'vigente', 'enabled'].includes(normalized);
            return { label: reported.trim(), variant: isOk ? 'success' : 'danger' };
        }

        if (key.validToDate) {
            const validTo = new Date(key.validToDate);
            if (!Number.isNaN(validTo.getTime())) {
                return validTo.getTime() < Date.now()
                    ? { label: 'Expirada', variant: 'danger' }
                    : { label: 'Vigente', variant: 'success' };
            }
        }

        return { label: '-', variant: 'simple' };
    }

    // ---------- Render ----------
    function renderTable() {
        const query = searchInput.value.trim();

        // Filtro por rango de fecha de creacion (inclusive); "hasta" cubre el dia completo
        const fromDate = dateFromInput.value ? new Date(`${dateFromInput.value}T00:00:00`) : null;
        const toDate = dateToInput.value ? new Date(`${dateToInput.value}T23:59:59.999`) : null;

        let rows = keys
            .filter((key) => {
                if (!fromDate && !toDate) return true;
                const createdAt = getCreatedAt(key);
                const createdDate = createdAt ? parseFlexibleDate(createdAt) : null;
                if (!createdDate) return false;
                if (fromDate && createdDate < fromDate) return false;
                if (toDate && createdDate > toDate) return false;
                return true;
            })
            .map((key) => {
                const isDynamic = Boolean(key.dynamic);
                const status = getKeyStatus(key);
                // Un solo campo de busqueda difusa (Levenshtein) sobre nombre, tipo, estado, algoritmo y uuid
                const candidates = [
                    key.clientName || getClientName(key.idClient),
                    isDynamic ? 'Dinámica' : 'Estática',
                    status.label,
                    key.algorithm,
                    key.uuid
                ];
                return { key, score: query ? bestSimilarityAmong(query, candidates) : null };
            });

        if (query) {
            rows = rows.filter((row) => row.score > 0.3).sort((a, b) => b.score - a.score);
        }

        tbody.innerHTML = '';
        emptyState.style.display = rows.length === 0 ? 'block' : 'none';

        rows.forEach(({ key }, index) => {
            const tr = document.createElement('tr');
            if (query && index === 0) tr.classList.add('best-match');
            const isDynamic = Boolean(key.dynamic);
            const status = getKeyStatus(key);
            const clientCell = canViewAllClients
                ? `<td>${escapeHtml(key.clientName || getClientName(key.idClient))}</td>`
                : '';

            tr.innerHTML = `
                <td class="client-name mono">${escapeHtml(key.uuid || '-')}</td>
                ${clientCell}
                <td><span class="badge-typeauth ${key.algorithm === 'AES' ? 'auth' : 'simple'}">${escapeHtml(key.algorithm || '-')}</span></td>
                <td><span class="badge-typeauth ${isDynamic ? 'other' : 'simple'}">${isDynamic ? 'Dinámica' : 'Estática'}</span>${key.main ? ' <span class="badge-admin">Principal</span>' : ''}</td>
                <td><span class="badge-typeauth ${status.variant}">${escapeHtml(status.label)}</span></td>
                <td>${formatDate(getCreatedAt(key))}</td>
                <td>
                    ${key.pvkey
                    ? `<button type="button" class="btn-key" data-action="view-key">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"></path>
                            </svg>
                            Ver llave
                        </button>`
                    : '<span class="text-muted">Sin llave</span>'}
                </td>
            `;
            if (key.pvkey) {
                tr.dataset.pvkey = key.pvkey;
                tr.dataset.keyUuid = key.uuid || '';
            }
            tbody.appendChild(tr);
        });
    }

    // ---------- Modal de la llave con copiado al portapapeles ----------
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // navigator.clipboard no existe fuera de contextos seguros (http en otra IP)
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            textarea.remove();
            return copied;
        }
    }

    function openKeyModal(pvkey, keyUuid) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';
        overlay.innerHTML = `
            <div class="modal-box key-box">
                <div class="modal-header">
                    <h2 class="modal-title">Llave privada</h2>
                    <button type="button" class="modal-close" data-action="close">&times;</button>
                </div>
                <p class="form-hint key-uuid"></p>
                <div class="key-display mono"></div>
                <button type="button" class="btn btn-primary" data-action="copy">Copiar llave</button>
            </div>
        `;
        overlay.querySelector('.key-uuid').textContent = keyUuid ? `UUID: ${keyUuid}` : '';
        overlay.querySelector('.key-display').textContent = pvkey;

        const copyBtn = overlay.querySelector('[data-action="copy"]');
        copyBtn.addEventListener('click', async () => {
            const copied = await copyToClipboard(pvkey);
            copyBtn.textContent = copied ? '¡Copiada!' : 'No se pudo copiar';
            copyBtn.classList.toggle('btn-danger', !copied);
            setTimeout(() => {
                copyBtn.textContent = 'Copiar llave';
                copyBtn.classList.remove('btn-danger');
            }, 2000);
        });

        const close = () => overlay.remove();
        overlay.querySelector('[data-action="close"]').addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });

        document.body.appendChild(overlay);
    }

    tbody.addEventListener('click', (event) => {
        const viewBtn = event.target.closest('[data-action="view-key"]');
        if (!viewBtn) return;
        const tr = viewBtn.closest('tr');
        openKeyModal(tr.dataset.pvkey, tr.dataset.keyUuid);
    });

    searchInput.addEventListener('input', renderTable);
    dateFromInput.addEventListener('change', renderTable);
    dateToInput.addEventListener('change', renderTable);
    btnClearDateFilter.addEventListener('click', () => {
        dateFromInput.value = '';
        dateToInput.value = '';
        renderTable();
    });

    // ---------- Carga de datos ----------
    async function fetchKeys(idClient) {
        try {
            const query = idClient ? `?idClient=${encodeURIComponent(idClient)}` : '';
            const data = await apiFetch(`/keys/list${query}`, { method: 'GET' });
            console.log('Respuesta de /keys/list:', data);
            return Array.isArray(data.keys) ? data.keys : [];
        } catch (error) {
            showResultModal(`No se pudo cargar la lista de llaves: ${error.message}`, 'danger', 'Error al cargar llaves');
            return [];
        }
    }

    async function fetchClients() {
        try {
            // Cacheada en sessionStorage: solo se pide al backend una vez por sesion
            return await fetchAllClientsCached();
        } catch (error) {
            showResultModal(`No se pudo cargar la lista de clientes: ${error.message}`, 'danger', 'Error al cargar clientes');
            return [];
        }
    }

    function fillClientSelects() {
        keyClientSelect.innerHTML = clients
            .filter((client) => client.uuid)
            .map((client) => `<option value="${escapeHtml(client.uuid)}">${escapeHtml(getClientName(client.uuid))}</option>`)
            .join('');
    }

    // ---------- Modal ----------
    function updatePvkeyFeedback() {
        const expected = KEY_LENGTH_BY_ALGORITHM[algorithmSelect.value];
        const length = pvkeyInput.value.length;
        if (!length) {
            pvkeyFeedback.textContent = `Debe tener ${expected} caracteres`;
            pvkeyFeedback.classList.remove('hint-invalid', 'hint-valid');
            return;
        }
        const isValid = length === expected;
        pvkeyFeedback.textContent = isValid ? 'Longitud correcta' : `Debe tener ${expected} caracteres (actual: ${length})`;
        pvkeyFeedback.classList.toggle('hint-invalid', !isValid);
        pvkeyFeedback.classList.toggle('hint-valid', isValid);
    }

    function generatePvkey() {
        const length = KEY_LENGTH_BY_ALGORITHM[algorithmSelect.value];
        const bytes = new Uint32Array(length);
        crypto.getRandomValues(bytes);
        pvkeyInput.value = Array.from(bytes, (n) => KEY_ALPHABET[n % KEY_ALPHABET.length]).join('');
        updatePvkeyFeedback();
    }

    pvkeyInput.addEventListener('input', updatePvkeyFeedback);
    algorithmSelect.addEventListener('change', updatePvkeyFeedback);
    btnGenerateKey.addEventListener('click', generatePvkey);
    dynamicCheckbox.addEventListener('change', () => {
        dynamicFields.style.display = dynamicCheckbox.checked ? 'block' : 'none';
    });

    function openModal() {
        modalOverlay.classList.add('show');
        hideAlert(modalAlert);
        createForm.reset();
        dynamicFields.style.display = 'none';
        updatePvkeyFeedback();
    }

    function closeModal() {
        modalOverlay.classList.remove('show');
    }

    btnOpenModal.addEventListener('click', openModal);
    btnCloseModal.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) closeModal();
    });

    // ---------- Crear llave ----------
    createForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideAlert(modalAlert);

        const algorithm = algorithmSelect.value;
        const pvkey = pvkeyInput.value.trim();
        const dynamic = dynamicCheckbox.checked;

        if (pvkey.length !== KEY_LENGTH_BY_ALGORITHM[algorithm]) {
            showAlert(modalAlert, `La llave debe tener ${KEY_LENGTH_BY_ALGORITHM[algorithm]} caracteres para ${algorithm}`);
            return;
        }

        const idClient = isAdmin ? keyClientSelect.value : ownUuid;
        if (isAdmin && !idClient) {
            showAlert(modalAlert, 'Selecciona el cliente dueño de la llave');
            return;
        }

        const payload = {
            uuid: crypto.randomUUID(),
            pvkey,
            algorithm,
            dynamic,
            main: document.getElementById('key-main').checked,
            idClient
        };

        if (dynamic) {
            payload.dynamicFreqSeg = Number(document.getElementById('key-dynamic-freq').value) || undefined;
            payload.dynamicWindowsTime = Number(document.getElementById('key-dynamic-window').value) || undefined;
            payload.dynamicValidFrom = toIsoOrUndefined(document.getElementById('key-dynamic-from').value);
            payload.dynamicValidTo = toIsoOrUndefined(document.getElementById('key-dynamic-to').value);
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';

        try {
            const data = await apiFetch('/keys/create', { method: 'POST', body: JSON.stringify(payload) });
            console.log('Respuesta de /keys/create:', data);
            closeModal();

            keys = await fetchKeys();
            renderTable();
            showResultModal(`La llave ${payload.uuid} se creó correctamente.`, 'success', 'Llave creada');
        } catch (error) {
            closeModal();
            showResultModal(`No se pudo crear la llave: ${error.message}`, 'danger', 'Error al crear la llave');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear llave';
        }
    });

    linkLogout.addEventListener('click', (event) => {
        event.preventDefault();
        clearSession();
        window.location.href = './login.html';
    });

    // ---------- Carga inicial ----------
    (async function init() {
        if (canViewAllClients) {
            clients = await fetchClients();
            fillClientSelects();
        }
        keys = await fetchKeys();
        renderTable();
    })();
});
