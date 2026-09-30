require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const clientsRoutes = require('./routes/clientsRoutes');
const keysRoutes = require('./routes/keysRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', authRoutes);
app.use('/clients', clientsRoutes);
app.use('/keys', keysRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
