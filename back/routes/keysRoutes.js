const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { validateCreateKeyInput } = require('../middleware/validators');
const { createKey, getKeys } = require('../controllers/keysProxyController');

const router = express.Router();

// Proxy hacia el servicio externo de llaves (127.0.0.1:3073)
router.post('/create', authMiddleware, authMiddleware.requireEditPermission, validateCreateKeyInput, createKey);
router.get('/list', authMiddleware, getKeys);

module.exports = router;
