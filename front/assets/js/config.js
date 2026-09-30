// Configuracion y helpers compartidos por las paginas del frontend

const API_BASE_URL = 'http://localhost:3000';

// Alta de clientes: pasa por el proxy de nuestro backend (POST /clients/create)
// porque el servicio externo real (127.0.0.1:3073/logic/createClient) no tiene CORS habilitado.
const CLIENTS_STORAGE_KEY = 'gse_vault_clients';

const TOKEN_KEY = 'gse_vault_token';
const USER_KEY = 'gse_vault_user';
// Cache de /clients/all compartida entre clientes/llaves/administradores durante la sesion
const ALL_CLIENTS_CACHE_KEY = 'gse_vault_all_clients_cache';

// sessionStorage: se borra al cerrar la pestana/navegador, a diferencia de localStorage que persiste indefinidamente
const saveSession = (token, user) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    console.log('Sesion guardada en sessionStorage:', { token, user });
};

const getToken = () => sessionStorage.getItem(TOKEN_KEY);

const getStoredUser = () => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
};

const clearSession = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ALL_CLIENTS_CACHE_KEY);
};

// Invalida la cache cuando se crea/edita un cliente para que la proxima vista traiga datos frescos
const clearCachedClients = () => sessionStorage.removeItem(ALL_CLIENTS_CACHE_KEY);

// Trae todos los clientes una sola vez por sesion; el resto de vistas reutilizan la cache en vez de volver al backend
const fetchAllClientsCached = async (forceRefresh = false) => {
    if (!forceRefresh) {
        try {
            const raw = sessionStorage.getItem(ALL_CLIENTS_CACHE_KEY);
            if (raw) return JSON.parse(raw);
        } catch {
            // cache corrupta: se ignora y se vuelve a pedir al backend
        }
    }
    const data = await apiFetch('/clients/all', { method: 'GET' });
    const list = Array.isArray(data.clientes) ? data.clientes : [];
    sessionStorage.setItem(ALL_CLIENTS_CACHE_KEY, JSON.stringify(list));
    return list;
};

// Llama a la API incluyendo el JWT en el header Authorization cuando existe
const apiFetch = async (path, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        // El servicio externo de clientes usa "error" (no "message") para describir la falla
        const message = (data.errors && data.errors.join(', ')) || data.message || data.error || 'Ocurrio un error';
        throw new Error(message);
    }
    return data;
};

const showAlert = (element, message, type = 'danger') => {
    element.textContent = message;
    element.className = `alert alert-${type} show`;
};

const hideAlert = (element) => {
    element.className = 'alert';
    element.textContent = '';
};

// ---------- Distancia de Levenshtein (busqueda tolerante a errores de tipeo) ----------
const levenshtein = (a, b) => {
    a = (a || '').toLowerCase();
    b = (b || '').toLowerCase();
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
};

// Similitud 0-1 (1 = coincidencia exacta) tomando el mejor valor de la lista de candidatos
const bestSimilarityAmong = (query, values) => {
    const normalized = (query || '').toLowerCase();
    let best = 0;
    (values || []).forEach((value) => {
        if (!value) return;
        const text = String(value).toLowerCase();
        // Una coincidencia parcial exacta (substring) siempre es la mejor opcion
        if (text.includes(normalized)) {
            best = 1;
            return;
        }
        const maxLen = Math.max(normalized.length, text.length) || 1;
        const similarity = 1 - levenshtein(normalized, text) / maxLen;
        if (similarity > best) best = similarity;
    });
    return best;
};

// ---------- Modal de resultado reutilizable (exito / error) ----------
const showResultModal = (message, type = 'success', title) => {
    document.querySelectorAll('.result-modal').forEach((modal) => modal.remove());

    const isSuccess = type === 'success';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay result-modal show';
    overlay.innerHTML = `
        <div class="modal-box result-box">
            <div class="result-icon ${isSuccess ? 'success' : 'danger'}">${isSuccess ? '✔' : '✕'}</div>
            <h2 class="modal-title result-title"></h2>
            <p class="result-message"></p>
            <button type="button" class="btn ${isSuccess ? 'btn-primary' : 'btn-danger'}">Aceptar</button>
        </div>
    `;
    overlay.querySelector('.result-title').textContent = title || (isSuccess ? 'Operación exitosa' : 'Ocurrió un error');
    overlay.querySelector('.result-message').textContent = message;

    const close = () => overlay.remove();
    overlay.querySelector('button').addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
    });

    document.body.appendChild(overlay);
};
