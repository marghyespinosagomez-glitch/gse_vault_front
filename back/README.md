# poc_gse_vault - Backend (Login con Express + servicio externo de clientes)

API REST de autenticación construida con Node.js, Express y JWT. No usa base de datos: el admin de demo está quemado en código y el resto de usuarios se valida contra un servicio externo de clientes.

## Estructura del proyecto

```
back/
├── config/
│   └── hardcodedAdmin.js         # Usuario admin quemado en código (solo para esta POC)
├── controllers/
│   ├── authController.js         # login (admin local o proxy al servicio externo)
│   └── clientsProxyController.js # createClient, getAllClients (proxy al servicio externo)
├── middleware/
│   ├── authMiddleware.js     # Verifica el JWT en rutas protegidas
│   └── validators.js         # Validación de inputs (email, password, etc.)
├── routes/
│   ├── authRoutes.js        # POST /login
│   └── clientsRoutes.js     # POST /clients/create, GET /clients/all
├── .env.example
├── package.json
└── server.js
```

## Requisitos previos

- Node.js 18+
- El servicio externo de clientes corriendo en `http://127.0.0.1:3073` (o la URL que definas en `EXTERNAL_CLIENTS_BASE_URL`)

## Instalación

```bash
cd back
npm install
cp .env.example .env
# Edita .env con tu configuración
npm start
```

El servidor queda escuchando en `http://localhost:3000` (o el `PORT` que definas).

Para desarrollo con recarga automática:

```bash
npm run dev
```

## Variables de entorno (`.env`)

| Variable                    | Descripción                                              |
|-----------------------------|-----------------------------------------------------------|
| `PORT`                      | Puerto del servidor Express                                |
| `JWT_SECRET`                | Secreto usado para firmar los tokens JWT                    |
| `JWT_EXPIRES_IN`            | Tiempo de expiración del token (ej. `1h`)                    |
| `EXTERNAL_CLIENTS_BASE_URL` | Base del servicio externo de clientes (por defecto `http://127.0.0.1:3073/logic`); se le concatena `/createClient`, `/getAllClients` y `/login` |

## Endpoints

| Método | Ruta               | Protegida | Descripción                                                              |
|--------|--------------------|-----------|-----------------------------------------------------------------------------|
| POST   | `/login`           | No        | Valida `admin`/`admin` localmente o el resto contra el servicio externo, devuelve un JWT |
| POST   | `/clients/create`  | Sí (JWT)  | Proxy hacia `POST {EXTERNAL_CLIENTS_BASE_URL}/createClient`               |
| GET    | `/clients/all`     | Sí (JWT)  | Proxy hacia `POST {EXTERNAL_CLIENTS_BASE_URL}/getAllClients` (lista los clientes reales) |

Las rutas protegidas requieren el header:

```
Authorization: Bearer <token>
```

### Ejemplo: Login

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@correo.com","password":"Clave123!"}'
```

### Validación de inputs

- **email**: formato de correo válido.
- **password (clientes)**: mínimo 8 caracteres, mayúscula, minúscula, número y símbolo (ver `isValidClientPassword` en `validators.js`).

## Usuario admin quemado (demo)

Para poder probar el login sin depender de ningún servicio externo, existe un usuario fijo definido en `config/hardcodedAdmin.js`:

- **email**: `admin`
- **password**: `admin`

Al iniciar sesión con estas credenciales, el backend genera un JWT válido sin llamar al servicio externo. Cualquier otro email/contraseña se valida contra `POST {EXTERNAL_CLIENTS_BASE_URL}/login`.

> ⚠️ Esto es únicamente para fines de demostración/POC. **No usar credenciales quemadas en código en un ambiente productivo.**

## Notas de seguridad

- Los JWT se firman con `JWT_SECRET` y expiran según `JWT_EXPIRES_IN`.
- La respuesta de `/login` nunca reenvía al front la contraseña ni el `keyToken` que devuelve el servicio externo.

