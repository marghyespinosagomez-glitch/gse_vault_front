const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { validateCreateClientInput } = require('../middleware/validators');
const { createClient, getAllClients, getClientsByRole, getClientByUuid, updateClients } = require('../controllers/clientsProxyController');

const router = express.Router();

// Proxy hacia el servicio externo de clientes (127.0.0.1:3073)
// Solo un admin puede crear clientes
router.post('/create', authMiddleware, authMiddleware.requireAdmin, validateCreateClientInput, createClient);
router.get('/all', authMiddleware, getAllClients);
// ?rol=cliente|admin -> POST /logic/getClientByRol { rol }
router.get('/by-role', authMiddleware, getClientsByRole);
// Un cliente consulta unicamente su propio registro (POST /logic/getClientByUuid con su uuid del JWT)
router.get('/by-uuid', authMiddleware, getClientByUuid);
router.post('/update', authMiddleware, authMiddleware.requireEditPermission, updateClients);

module.exports = router;
