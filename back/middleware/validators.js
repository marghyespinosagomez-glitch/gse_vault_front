const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Minimo 8 caracteres, con mayuscula, minuscula, numero y simbolo (contrasena de clientes)
const CLIENT_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]).{8,}$/;

const isValidEmail = (email) => typeof email === 'string' && EMAIL_REGEX.test(email);

const isValidClientPassword = (password) => typeof password === 'string' && CLIENT_PASSWORD_REGEX.test(password);

const CLIENT_ROLES = ['admin', 'cliente'];

// Valida el body de POST /login
const validateLoginInput = (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];

    if (!email || typeof email !== 'string') {
        errors.push('El email es obligatorio');
    }
    if (!password || typeof password !== 'string') {
        errors.push('La contrasena es obligatoria');
    }

    if (errors.length > 0) {
        return res.status(400).json({ message: 'Datos invalidos', errors });
    }
    next();
};

// Valida el body de POST /clients/create
const validateCreateClientInput = (req, res, next) => {
    const { nameApp, email, pass, rol, visual } = req.body;
    const errors = [];

    if (!nameApp || typeof nameApp !== 'string' || !nameApp.trim()) {
        errors.push('El nombre es obligatorio');
    }
    if (!isValidEmail(email)) {
        errors.push('El email no es valido');
    }
    if (!isValidClientPassword(pass)) {
        errors.push('La contrasena debe tener minimo 8 caracteres, con mayuscula, minuscula, numero y simbolo');
    }
    if (rol !== undefined && !CLIENT_ROLES.includes(rol)) {
        errors.push(`El rol debe ser uno de: ${CLIENT_ROLES.join(', ')}`);
    }
    if (visual !== undefined && typeof visual !== 'boolean') {
        errors.push('visual debe ser true o false');
    }

    if (errors.length > 0) {
        return res.status(400).json({ message: 'Datos invalidos', errors });
    }
    next();
};

// Longitud exacta que exige cada algoritmo simetrico
const KEY_LENGTH_BY_ALGORITHM = { '3DES': 24, AES: 32 };

// Valida el body de POST /keys/create
const validateCreateKeyInput = (req, res, next) => {
    const { pvkey, algorithm, dynamic, dynamicFreqSeg, dynamicWindowsTime } = req.body;
    const errors = [];

    if (!KEY_LENGTH_BY_ALGORITHM[algorithm]) {
        errors.push('El algoritmo debe ser 3DES o AES');
    } else if (typeof pvkey !== 'string' || pvkey.length !== KEY_LENGTH_BY_ALGORITHM[algorithm]) {
        errors.push(`La llave privada debe tener ${KEY_LENGTH_BY_ALGORITHM[algorithm]} caracteres para ${algorithm}`);
    }

    if (dynamic) {
        if (dynamicFreqSeg !== undefined && (!Number.isInteger(dynamicFreqSeg) || dynamicFreqSeg <= 0)) {
            errors.push('La frecuencia dinamica debe ser un entero mayor a 0');
        }
        if (dynamicWindowsTime !== undefined && (!Number.isInteger(dynamicWindowsTime) || dynamicWindowsTime <= 0)) {
            errors.push('La ventana de tiempo debe ser un entero mayor a 0');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ message: 'Datos invalidos', errors });
    }
    next();
};

module.exports = {
    isValidEmail,
    isValidClientPassword,
    CLIENT_ROLES,
    KEY_LENGTH_BY_ALGORITHM,
    validateLoginInput,
    validateCreateClientInput,
    validateCreateKeyInput
};
