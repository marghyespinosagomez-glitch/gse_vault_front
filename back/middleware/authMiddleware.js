const jwt = require('jsonwebtoken');

// Verifica que la peticion incluya un JWT valido en el header Authorization: Bearer <token>
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Token no proporcionado' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token invalido o expirado' });
    }
};

// Solo deja pasar a usuarios con rol 'admin'; usar despues de authMiddleware
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.admin) {
        return res.status(403).json({ message: 'No tienes permisos de administrador para esta accion' });
    }
    next();
};

// El admin visual (visual:true) solo puede leer: bloquea cualquier accion de creacion/edicion
const requireEditPermission = (req, res, next) => {
    if (req.user && req.user.visual) {
        return res.status(403).json({ message: 'Tu rol solo tiene permisos de lectura' });
    }
    next();
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.requireEditPermission = requireEditPermission;
