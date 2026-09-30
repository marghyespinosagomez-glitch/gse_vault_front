// Reenvia peticiones al servicio externo de clientes (127.0.0.1:3073), evitando el bloqueo CORS
// que ocurre si el front intenta llamarlo directamente desde el navegador.
const EXTERNAL_CLIENTS_BASE_URL = process.env.EXTERNAL_CLIENTS_BASE_URL || 'http://127.0.0.1:3073/logic';
const crypto = require('../utils/crypto');

const createClient = async (req, res) => {
    try {
        // Schema real esperado por el servicio externo
        const externalToken = crypto.decrypt(req.user.ts);
        console.log('externalToken (proxy):', externalToken);
        const { uuid, email, nameApp, typeAuth, pass, rol, visual } = req.body;

        const payload = { uuid, email, nameApp, typeAuth, pass, rol };
        // El admin visual se marca con visual:true; en el resto de casos no hace falta enviarlo
        if (visual) payload.visual = true;

        const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}/createClient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token-gse': externalToken  },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Error en createClient (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de clientes (127.0.0.1:3073)' });
    }
};

// Lista los clientes ya existentes en el servicio externo (endpoint real: POST /logic/getAllClients)
const getAllClients = async (req, res) => {
    try {
        const externalToken = crypto.decrypt(req.user.ts);
        console.log('externalToken (proxy):', externalToken);
        const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}/getAllClients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token-gse': externalToken },
            body: JSON.stringify({})
        });

        const data = await response.json().catch(() => ({}));
        console.log('data (proxy):', data);
        const clientesLimpios = Array.isArray(data.clientes)
            ? data.clientes.map(({ pass, keyToken, ...safe }) => safe)
            : data;
        return res.status(response.status).json({ ...data, clientes: clientesLimpios })
    } catch (error) {
        console.error('Error en getAllClients (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de clientes (127.0.0.1:3073)' });
    }
};

const CLIENT_ROLES = ['admin', 'cliente'];

// Lista los clientes filtrados por rol (endpoint real: POST /logic/getClientByRol)
const getClientsByRole = async (req, res) => {
    try {
        const rol = req.query.rol;
        if (!CLIENT_ROLES.includes(rol)) {
            return res.status(400).json({ message: `El rol debe ser uno de: ${CLIENT_ROLES.join(', ')}` });
        }

        const externalToken = crypto.decrypt(req.user.ts);
        const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}/getClientByRol`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token-gse': externalToken },
            body: JSON.stringify({ rol })
        });

        const data = await response.json().catch(() => ({}));
        console.log('data getClientByRol (proxy):', data);
        // El servicio externo no siempre usa el mismo nombre para el arreglo de clientes
        const rawList = data.clientes || data.clients || (Array.isArray(data) ? data : []);
        const clientesLimpios = Array.isArray(rawList)
            ? rawList.map(({ pass, keyToken, ...safe }) => safe)
            : [];
        return res.status(response.status).json({ ...data, clientes: clientesLimpios });
    } catch (error) {
        console.error('Error en getClientsByRole (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de clientes (127.0.0.1:3073)' });
    }
};

// Trae un unico cliente por su uuid (endpoint real: POST /logic/getClientByUuid)
// Un rol "cliente" solo puede consultar su propio uuid (viene del JWT, no del query)
const getClientByUuid = async (req, res) => {
    try {
        const uuid = req.user.uuid;
        if (!uuid) {
            return res.status(400).json({ message: 'No se pudo determinar el uuid del cliente' });
        }

        const externalToken = crypto.decrypt(req.user.ts);
        const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}/getClientByUuid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token-gse': externalToken },
            body: JSON.stringify({ uuid })
        });

        const data = await response.json().catch(() => ({}));
        console.log('data getClientByUuid (proxy):', data);
        // El servicio externo puede devolver el cliente suelto o dentro de client/cliente
        const client = data.client || data.cliente || (Array.isArray(data.clientes) ? data.clientes[0] : null) || data;
        const { pass, keyToken, ...safeClient } = client || {};
        return res.status(response.status).json({ ...data, clientes: safeClient && safeClient.uuid ? [safeClient] : [] });
    } catch (error) {
        console.error('Error en getClientByUuid (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de clientes (127.0.0.1:3073)' });
    }
};

const updateClients = async (req, res) => {
    try {
        const externalToken = crypto.decrypt(req.user.ts);
        console.log('externalToken (proxy):', externalToken);
        console.log('req.body:', req.body);
        const { uuid, nameApp, typeAuth} = req.body;
        const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}/updateClient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token-gse': externalToken },
            body: JSON.stringify({uuid, nameApp, typeAuth})
        });

        const data = await response.json().catch(() => ({}));
        console.log('data (proxy):', data);
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Error en updateClients (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de clientes (127.0.0.1:3073)' });
    }
};

module.exports = { createClient, getAllClients, getClientsByRole, getClientByUuid, updateClients };
