/**
 * server.js
 * Ponto de entrada do servidor FixDesk.
 * Configuração do Express, middlewares, rotas da API e arquivos estáticos da pasta public.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');
const osController = require('./controllers/osController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares essenciais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do front-end (HTML, CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

/* ======================================================
   ROTAS DA API REST - FIXDESK
====================================================== */

// Rotas de Ordens de Serviço (OS)
app.get('/api/os', osController.listarOS);
app.get('/api/os/resumo', osController.obterResumo);
app.get('/api/os/:id', osController.obterOSPorId);
app.post('/api/os', osController.criarOS);
app.patch('/api/os/:id/status', osController.atualizarStatusOS);

// Rotas de Clientes
app.get('/api/clientes', osController.listarClientes);
app.post('/api/clientes', osController.cadastrarCliente);

// Rota raiz garantindo a entrega da interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[-] Erro não tratado no servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Ocorreu um erro interno no servidor FixDesk.',
    error: err.message
  });
});

/**
 * Inicialização do Banco de Dados e Inicialização do Servidor HTTP
 */
async function startServer() {
  try {
    console.log('----------------------------------------------------');
    console.log(' Inicializando o Sistema FixDesk (Gestão de OS)...');
    console.log('----------------------------------------------------');

    // Inicializa tabelas e seeds no SQLite
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`[✓] Servidor FixDesk executando com sucesso!`);
      console.log(`[✓] Acesso Web: http://localhost:${PORT}`);
      console.log(`[✓] Arquivos Estáticos: ${path.join(__dirname, 'public')}`);
      console.log('----------------------------------------------------');
    });
  } catch (error) {
    console.error('[-] Falha crítica na inicialização do FixDesk:', error);
    process.exit(1);
  }
}

startServer();

