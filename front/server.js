// Servidor estático simple (sin dependencias) para servir el front en desarrollo
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const relativePath = urlPath === '/' ? '/clients.html' : urlPath;
    const filePath = path.join(ROOT, relativePath);

    // Evita salir de la carpeta del proyecto (path traversal)
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404 - Archivo no encontrado');
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Front corriendo en http://localhost:${PORT}/clients.html`);
});
