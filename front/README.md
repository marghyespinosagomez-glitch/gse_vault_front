# poc_gse_vault - Frontend (Login / Registro)

Interfaz estática (HTML + CSS + JS puro) que consume la API del backend (`../back`). El estilo (paleta de colores, tipografía `Inter`, tarjetas redondeadas con sombra suave) está replicado del proyecto `poc_bematch`.

## Estructura

```
front/
├── index.html          # Redirecciona a login.html
├── login.html
├── clients.html         # Gestor de clientes (tabla + buscador Levenshtein + alta)
└── assets/
    ├── css/style.css
    └── js/
        ├── config.js    # URL de la API, sesión (sessionStorage) y config del gestor de clientes
        ├── login.js
        └── clients.js   # Levenshtein, render de tabla, modal de alta, POST a servicio de clientes
```

## Cómo correrlo

1. Asegúrate de que el backend (`../back`) esté corriendo en `http://localhost:3000` (o ajusta `API_BASE_URL` en `assets/js/config.js`).
2. Levanta el front con el servidor estático incluido (Node puro, sin dependencias):

   ```bash
   cd front
   npm start
   ```

3. Abre `http://localhost:5500/login.html` (el puerto se puede cambiar con la variable de entorno `PORT`).

## Flujo

- **login.html**: inicia sesión (email + contraseña) contra el backend, que valida el admin quemado localmente o el resto de usuarios contra el servicio externo de clientes; guarda el JWT en `sessionStorage` y redirige a `clients.html`.
- **clients.html**: gestor de clientes (ver sección siguiente).

### Usuario demo (quemado en el backend)

- Email: `admin`
- Password: `admin`

Este usuario no requiere base de datos y no se puede editar/eliminar (ver README del backend).

## Gestor de clientes (`clients.html`)

Pantalla protegida (requiere sesión) que consume un **servicio externo** de clientes corriendo en `http://127.0.0.1:3073/logic`. Ese servicio no tiene CORS habilitado, así que el front **no lo llama directo**: pasa por el proxy de nuestro backend (`back/controllers/clientsProxyController.js`), protegido con JWT.

- **Listado real** (`GET /clients/all` → `POST {base}/getAllClients`): al cargar la pantalla se trae la lista real de clientes. Cada cliente puede traer campos distintos (`uuid`, `email`, `nameApp`, `typeAuth`, `idClient`, `keyToken`, `config`, etc.); la tabla usa `nameApp`/`email` cuando existen, y cae a un nombre genérico (`Cliente <uuid corto>`) si no vienen.
- **Crear cliente** (`POST /clients/create` → `POST {base}/createClient`): el botón "+ Crear cliente" abre un modal que pide `nombre`, `correo` y `typeAuth`. ⚠️ El servicio real espera el campo `email` (no `correo`), por lo que esta creación puede fallar hasta ajustar el body en `clientsProxyController.js`; si falla, el cliente igual se agrega a la tabla (guardado en `sessionStorage`) con una advertencia.
- **Buscador**: un único campo de texto que filtra/ordena la tabla calculando la **distancia de Levenshtein** contra el nombre/correo de cada cliente, mostrando primero la coincidencia más cercana (junto con el % de similitud).
