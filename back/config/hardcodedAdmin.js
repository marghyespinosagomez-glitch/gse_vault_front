// Usuario "quemado" en el codigo, solo para esta POC: permite iniciar sesion sin usar la base de datos.
// NUNCA usar este patron en un ambiente productivo.
const HARDCODED_ADMIN = {
    id: 'admin-hardcoded-000',
    name: 'Administrator',
    email: 'admin',
    password: 'admin',
    role: 'admin'
};

module.exports = { HARDCODED_ADMIN };
