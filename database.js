/**
 * database.js
 * Módulo de conexão com o banco de dados SQLite e inicialização automática
 * do esquema e dados de teste (seed inicial).
 * Projeto FixDesk - Gestão de Ordens de Serviço
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho do arquivo do banco SQLite
const dbPath = path.resolve(__dirname, 'fixdesk.db');

// Criação da conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[-] Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('[+] Conectado ao banco de dados SQLite com sucesso:', dbPath);
  }
});

// Habilita suporte a chaves estrangeiras no SQLite
db.run('PRAGMA foreign_keys = ON;');

/**
 * Funções auxiliares baseadas em Promises para simplificar queries assíncronas
 */
const dbAsync = {
  // Executa INSERT, UPDATE, DELETE e retorna { id, changes }
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },

  // Retorna um único registro (SELECT ... LIMIT 1)
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  // Retorna todos os registros correspondentes
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  // Executa múltiplos comandos DDL sequencialmente
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};

/**
 * Inicialização do Esquema Relacional e Carga Inicial de Dados (Seed)
 */
async function initDatabase() {
  try {
    // 1. Criação das Tabelas
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS Usuario (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha_hash TEXT NOT NULL,
          perfil TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Cliente (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          cpf TEXT UNIQUE NOT NULL,
          telefone TEXT,
          email TEXT
      );

      CREATE TABLE IF NOT EXISTS OrdemServico (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliente_id INTEGER NOT NULL,
          usuario_id INTEGER NOT NULL,
          equipamento TEXT NOT NULL,
          defeito_relatado TEXT NOT NULL,
          laudo_tecnico TEXT,
          status TEXT DEFAULT 'Recebido',
          valor_mao_obra REAL DEFAULT 0.00,
          valor_total REAL DEFAULT 0.00,
          data_abertura DATETIME DEFAULT CURRENT_TIMESTAMP,
          data_finalizacao DATETIME,
          FOREIGN KEY (cliente_id) REFERENCES Cliente(id),
          FOREIGN KEY (usuario_id) REFERENCES Usuario(id)
      );

      CREATE TABLE IF NOT EXISTS ItemServico (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ordem_servico_id INTEGER NOT NULL,
          descricao TEXT NOT NULL,
          quantidade INTEGER DEFAULT 1,
          valor_unitario REAL NOT NULL,
          FOREIGN KEY (ordem_servico_id) REFERENCES OrdemServico(id) ON DELETE CASCADE
      );
    `);

    console.log('[+] Esquema relacional verificado/criado com sucesso.');

    // 2. Seed: Usuário Padrão (necessário para a FK usuario_id da OrdemServico)
    const userCount = await dbAsync.get('SELECT COUNT(*) AS total FROM Usuario');
    if (userCount.total === 0) {
      await dbAsync.run(
        `INSERT INTO Usuario (nome, email, senha_hash, perfil) 
         VALUES (?, ?, ?, ?)`,
        ['Técnico Responsável', 'tecnico@fixdesk.com', '$2b$10$simulatedHashFixDesk2026', 'Técnico Sênior']
      );
      console.log('[+] Seed: Usuário padrão cadastrado.');
    }

    // 3. Seed: 2 Clientes Iniciais
    const clientCount = await dbAsync.get('SELECT COUNT(*) AS total FROM Cliente');
    if (clientCount.total === 0) {
      await dbAsync.run(
        `INSERT INTO Cliente (nome, cpf, telefone, email) 
         VALUES (?, ?, ?, ?)`,
        ['Carlos Eduardo Silva', '123.456.789-01', '(11) 98765-4321', 'carlos.silva@email.com']
      );

      await dbAsync.run(
        `INSERT INTO Cliente (nome, cpf, telefone, email) 
         VALUES (?, ?, ?, ?)`,
        ['Mariana Oliveira Santos', '987.654.321-09', '(21) 97654-3210', 'mariana.santos@email.com']
      );
      console.log('[+] Seed: 2 clientes iniciais cadastrados com sucesso.');
    }

    // 4. Seed: 2 Ordens de Serviço Iniciais com Itens e Cálculo do Total
    const osCount = await dbAsync.get('SELECT COUNT(*) AS total FROM OrdemServico');
    if (osCount.total === 0) {
      // OS 1: Cliente 1 (Carlos), Concluída
      // Mão de obra (120.00) + Pasta Térmica (45.00) + Limpeza (35.00) = 200.00
      const os1 = await dbAsync.run(
        `INSERT INTO OrdemServico (
            cliente_id, usuario_id, equipamento, defeito_relatado, laudo_tecnico,
            status, valor_mao_obra, valor_total, data_abertura, data_finalizacao
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'), datetime('now', '-1 day'))`,
        [
          1,
          1,
          'Notebook Dell Inspiron 15',
          'Superaquecimento constante, desligamento repentino e ruído excessivo no cooler.',
          'Realizada desmontagem completa, desoxidação preventiva, limpeza física do cooler e aplicação de pasta térmica de prata.',
          'Concluído',
          120.00,
          200.00
        ]
      );

      // Itens da OS 1
      await dbAsync.run(
        `INSERT INTO ItemServico (ordem_servico_id, descricao, quantidade, valor_unitario) VALUES (?, ?, ?, ?)`,
        [os1.id, 'Pasta Térmica Prata Alta Condutividade', 1, 45.00]
      );
      await dbAsync.run(
        `INSERT INTO ItemServico (ordem_servico_id, descricao, quantidade, valor_unitario) VALUES (?, ?, ?, ?)`,
        [os1.id, 'Limpeza Química e Desoxidação de Contatos', 1, 35.00]
      );

      // OS 2: Cliente 2 (Mariana), Em Análise
      // Mão de obra (150.00) + Fonte 650W (380.00) = 530.00
      const os2 = await dbAsync.run(
        `INSERT INTO OrdemServico (
            cliente_id, usuario_id, equipamento, defeito_relatado, laudo_tecnico,
            status, valor_mao_obra, valor_total, data_abertura, data_finalizacao
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'), NULL)`,
        [
          2,
          1,
          'PC Gamer Custom (Ryzen 5 / RTX 3060)',
          'Equipamento não inicializa nem emite sinais de energia após chuva com descargas elétricas.',
          'Diagnóstico inicial: Fonte de alimentação em curto circuito. Placa-mãe e GPU testadas e operacionais.',
          'Em Análise',
          150.00,
          530.00
        ]
      );

      // Itens da OS 2
      await dbAsync.run(
        `INSERT INTO ItemServico (ordem_servico_id, descricao, quantidade, valor_unitario) VALUES (?, ?, ?, ?)`,
        [os2.id, 'Fonte de Alimentação 650W 80 Plus Bronze', 1, 380.00]
      );

      console.log('[+] Seed: 2 Ordens de Serviço com itens inseridas com sucesso.');
    }
  } catch (error) {
    console.error('[-] Erro ao inicializar banco de dados e seed:', error);
    throw error;
  }
}

module.exports = {
  db,
  dbAsync,
  initDatabase
};

