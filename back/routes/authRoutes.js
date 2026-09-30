const express = require('express');
const authController = require('../controllers/authController');
const { validateLoginInput } = require('../middleware/validators');

const router = express.Router();

router.post('/login', validateLoginInput, authController.login);

module.exports = router;
