// Reenvia peticiones de llaves al servicio externo (127.0.0.1:3073), evitando el bloqueo CORS
// que ocurre si el front intenta llamarlo directamente desde el navegador.
const EXTERNAL_CLIENTS_BASE_URL = process.env.EXTERNAL_CLIENTS_BASE_URL || 'http://127.0.0.1:3073/logic';
const crypto = require('../utils/crypto');
const { randomUUID } = require('crypto');

// Solo envia al servicio externo los campos opcionales que realmente llegaron
const withDefined = (obj) =>
    Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== ''));

const externalPost = async (path, body, externalToken) => {
    const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token-gse': externalToken },
        body: JSON.stringify(body)
    });
    const raw = await response.text();
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        data = { message: raw };
    }
    console.log(`[keys proxy] POST ${path} ->`, response.status, raw);
    return { status: response.status, ok: response.ok, data };
};

const externalGet = async (path, externalToken) => {
    const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}${path}`, {
        method: 'GET',
        headers: { 'token-gse': externalToken }
    });
    const raw = await response.text();
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        data = { message: raw };
    }
    console.log(`[keys proxy] GET ${path} ->`, response.status, raw);
    return { status: response.status, ok: response.ok, data };
};

// El servicio externo no siempre usa el mismo nombre para el arreglo de llaves
const extractKeys = (data) => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];

    const known = data.keys || data.llaves || data.claves || data.result;
    if (Array.isArray(known)) return known;

    // Fallback: toma el primer campo que sea un arreglo de objetos
    const entry = Object.entries(data).find(
        ([, value]) => Array.isArray(value) && (value.length === 0 || typeof value[0] === 'object')
    );
    if (entry) {
        console.log(`[keys proxy] arreglo de llaves detectado en el campo "${entry[0]}"`);
        return entry[1];
    }

    console.warn('[keys proxy] getKeys no devolvio ningun arreglo. Campos recibidos:', Object.keys(data));
    return [];
};

// POST /keys/create
const createKey = async (req, res) => {
    try {
        const externalToken = crypto.decrypt(req.user.ts);
        const {
            pvkey,
            pubkey,
            validToDate,
            uuid,
            dynamic,
            dynamicValidTo,
            dynamicLastKey,
            dynamicValidFrom,
            main,
            dynamicFreqSeg,
            dynamicWindowsTime,
            algorithm
        } = req.body;

        // Un cliente no admin solo puede crear llaves para si mismo (identificado por su uuid)
        const idClient = req.user.admin ? req.body.idClient || req.user.uuid : req.user.uuid;
        if (!idClient) {
            return res.status(400).json({
                message: 'No se pudo determinar el cliente dueño de la llave. Vuelve a iniciar sesión.'
            });
        }

        const payload = withDefined({
            pvkey,
            pubkey,
            validToDate,
            uuid: uuid || randomUUID(),
            dynamicValidTo,
            dynamicLastKey,
            dynamicValidFrom,
            dynamicFreqSeg,
            dynamicWindowsTime,
            idClient,
            algorithm
        });
        payload.dynamic = Boolean(dynamic);
        if (main !== undefined) payload.main = Boolean(main);

        console.log('[keys proxy] createKey payload:', payload);
        const { status, ok, data } = await externalPost('/createKey', payload, externalToken);

        // El servicio externo puede responder 200 con success:false o con un campo error
        if (!ok || data.success === false || data.error) {
            return res.status(ok ? 400 : status).json({
                message: data.error || data.message || 'El servicio externo rechazó la creación de la llave',
                external: data
            });
        }

        return res.status(status).json({ ...data, key: data.key || data.newKey || data.llave || payload });
    } catch (error) {
        console.error('Error en createKey (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de llaves (127.0.0.1:3073)' });
    }
};

// GET /keys/list?idClient=<uuid del cliente>
// Cliente: siempre POST /logic/getKeys { uuid } con su propio uuid.
// Admin (editor o visual): siempre GET /logic/getAllKeys; si viene idClient, se filtra en memoria.
const getKeys = async (req, res) => {
    try {
        const externalToken = crypto.decrypt(req.user.ts);
        const requestedClient = req.query.idClient;
        const ownUuid = req.user.uuid;
        const canViewAll = req.user.rol === 'admin';

        if (!canViewAll) {
            if (requestedClient && requestedClient !== ownUuid) {
                return res.status(403).json({ message: 'No tienes permiso para consultar llaves de otro cliente' });
            }
            const { status, data } = await externalPost('/getKeys', { uuid: ownUuid }, externalToken);
            return res.status(status).json({ ...data, keys: extractKeys(data) });
        }

        // Admin/admin visual: trae todas las llaves de una sola vez (GET /logic/getAllKeys)
        // El front resuelve el nombre del cliente con su propia cache de /clients/all, no hace falta pedirla aqui
        const { status, data } = await externalGet('/getAllKeys', externalToken);
        let keys = extractKeys(data);

        if (requestedClient) {
            keys = keys.filter((key) => key.idClient === requestedClient);
        }

        return res.status(status).json({ ...data, keys });
    } catch (error) {
        console.error('Error en getKeys (proxy):', error);
        return res.status(502).json({ message: 'No se pudo conectar con el servicio de llaves (127.0.0.1:3073)' });
    }
};

module.exports = { createKey, getKeys };
