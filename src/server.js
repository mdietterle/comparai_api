require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { compareHandler, listShoppingListsHandler, compareByListNameHandler } = require('./controllers/priceController');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.post('/api/compare', compareHandler);
app.get('/api/lists', listShoppingListsHandler);
app.get('/api/compare/list/:name', compareByListNameHandler);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler global
app.use((err, req, res, _next) => {
  logger.error('Erro não tratado:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  logger.info(`Economize API rodando na porta ${PORT}`);
  logger.info(`POST http://localhost:${PORT}/api/compare`);
  logger.info(`GET  http://localhost:${PORT}/api/health`);
});

module.exports = app;
