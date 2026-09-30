const jwt = require('jsonwebtoken');
const { HARDCODED_ADMIN } = require('../config/hardcodedAdmin');
const crypto = require('../utils/crypto');

// Mismo servicio externo usado para el CRUD de clientes (127.0.0.1:3073)
const EXTERNAL_CLIENTS_BASE_URL = process.env.EXTERNAL_CLIENTS_BASE_URL || 'http://127.0.0.1:3073/logic';

const generateToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

// POST /login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Usuario admin quemado en el codigo: no consulta la base de datos ni el servicio externo
        if (email === HARDCODED_ADMIN.email && password === HARDCODED_ADMIN.password) {
            const token = generateToken({
                id: HARDCODED_ADMIN.id,
                email: HARDCODED_ADMIN.email,
                name: HARDCODED_ADMIN.name,
                role: HARDCODED_ADMIN.role,
                rol: HARDCODED_ADMIN.role,
                uuid: HARDCODED_ADMIN.id,
                admin: true
            });
            return res.status(200).json({
                message: 'Login exitoso',
                token,
                user: {
                    id: HARDCODED_ADMIN.id,
                    name: HARDCODED_ADMIN.name,
                    email: HARDCODED_ADMIN.email,
                    role: HARDCODED_ADMIN.role,
                    rol: HARDCODED_ADMIN.role,
                    admin: true
                }
            });
        }

        // Resto de usuarios: se validan contra el servicio externo de clientes (127.0.0.1:3073/logic/login)
        let externalData;
        try {
            const response = await fetch(`${EXTERNAL_CLIENTS_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, pass: password })
            });
            externalData = await response.json().catch(() => ({}));

            if (!response.ok || externalData.success === false) {
                return res.status(401).json({ message: 'Credenciales invalidas' });
            }
        } catch (error) {
            console.error('Error validando login en servicio externo:', error);
            return res.status(502).json({ message: 'No se pudo conectar con el servicio de clientes (127.0.0.1:3073)' });
        }

        // El cliente puede venir en distintas propiedades segun la respuesta del servicio externo
        const client = externalData.client || externalData.cliente || externalData.newClient || externalData;
        const name = client.nameApp || client.nombre || email;
        // Nunca reenviar al front la contrasena ni el keyToken interno del servicio externo
        const { pass: _omitPass, keyToken: _omitKeyToken, success: _omitSuccess, tokenSession, processId: _omitProcessId, ...safeClient } = client;

        // El token de sesion contra el servicio externo puede venir como tokenSession o como keyToken
        const externalSessionToken = tokenSession || client.keyToken;
        const encryptedSession = externalSessionToken ? crypto.encriptar(externalSessionToken) : null;

        // Los permisos se basan en "rol" (admin | cliente) mas el flag "visual" (admin de solo lectura)
        const rol = client.rol || (client.admin ? 'admin' : 'cliente');
        const isAdminRole = rol === 'admin';
        const visual = Boolean(client.visual);
        // Solo un admin sin visual puede crear/editar; el admin visual solo lee
        const canManage = isAdminRole && !visual;

        console.log('externalData::: ', externalData)
        // uuid, rol y visual viajan en el JWT para poder autorizar sin confiar en el body del front
        // Las llaves se consultan siempre por el uuid del cliente, no por idClient
        const token = generateToken({
            email,
            name,
            role: isAdminRole ? 'admin' : 'client',
            rol,
            visual,
            uuid: client.uuid,
            admin: canManage,
            ts: encryptedSession
        });
        return res.status(200).json({
            message: 'Login exitoso',
            token,
            user: { ...safeClient, email, name, rol, visual, admin: canManage }
        });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ message: 'Error al iniciar sesion' });
    }
};

module.exports = { login };
