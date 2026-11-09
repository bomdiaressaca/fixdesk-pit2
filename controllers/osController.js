/**
 * controllers/osController.js
 * Controlador responsável pela lógica de negócio do FixDesk:
 * - Listagem de Ordens de Serviço (com suporte a filtros por status e busca)
 * - Criação de OS com transação atômica e cálculo automático do valor total
 * - Atualização de status e laudo técnico da OS
 * - Gestão de Clientes (listagem e cadastro com validação de CPF)
 * - Obtenção de métricas de resumo (cards do dashboard)
 */

const { dbAsync } = require('../database');

const osController = {
  /**
   * GET /api/os
   * Lista todas as Ordens de Serviço com JOIN em Cliente e Usuario.
   * Suporta filtro por query params: ?status=Em Análise&busca=Dell
   */
  async listarOS(req, res) {
    try {
      const { status, busca } = req.query;

      let sql = `
        SELECT 
          os.id,
          os.cliente_id,
          c.nome AS cliente_nome,
          c.cpf AS cliente_cpf,
          c.telefone AS cliente_telefone,
          c.email AS cliente_email,
          os.usuario_id,
          u.nome AS usuario_nome,
          os.equipamento,
          os.defeito_relatado,
          os.laudo_tecnico,
          os.status,
          os.valor_mao_obra,
          os.valor_total,
          os.data_abertura,
          os.data_finalizacao
        FROM OrdemServico os
        INNER JOIN Cliente c ON os.cliente_id = c.id
        INNER JOIN Usuario u ON os.usuario_id = u.id
        WHERE 1 = 1
      `;
      const params = [];

      // Filtro obrigatório de status
      if (status && status !== 'Todos' && status.trim() !== '') {
        sql += ` AND os.status = ?`;
        params.push(status.trim());
      }

      // Filtro opcional de busca textual (equipamento, cliente, cpf ou ID)
      if (busca && busca.trim() !== '') {
        const termo = `%${busca.trim()}%`;
        sql += ` AND (
          os.equipamento LIKE ? OR 
          c.nome LIKE ? OR 
          c.cpf LIKE ? OR 
          os.id = ?
        )`;
        params.push(termo, termo, termo, busca.trim());
      }

      sql += ` ORDER BY os.id DESC`;

      const ordens = await dbAsync.all(sql, params);

      // Para cada ordem, busca os respectivos itens de serviço
      for (const os of ordens) {
        const itens = await dbAsync.all(
          `SELECT id, descricao, quantidade, valor_unitario, (quantidade * valor_unitario) AS subtotal
           FROM ItemServico
           WHERE ordem_servico_id = ?
           ORDER BY id ASC`,
          [os.id]
        );
        os.itens = itens;
      }

      return res.status(200).json({
        success: true,
        total: ordens.length,
        data: ordens
      });
    } catch (error) {
      console.error('[-] Erro ao listar Ordens de Serviço:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar Ordens de Serviço.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/os/:id
   * Retorna os detalhes de uma OS específica junto com seus itens.
   */
  async obterOSPorId(req, res) {
    try {
      const { id } = req.params;

      const os = await dbAsync.get(
        `SELECT 
          os.id,
          os.cliente_id,
          c.nome AS cliente_nome,
          c.cpf AS cliente_cpf,
          c.telefone AS cliente_telefone,
          c.email AS cliente_email,
          os.usuario_id,
          u.nome AS usuario_nome,
          os.equipamento,
          os.defeito_relatado,
          os.laudo_tecnico,
          os.status,
          os.valor_mao_obra,
          os.valor_total,
          os.data_abertura,
          os.data_finalizacao
        FROM OrdemServico os
        INNER JOIN Cliente c ON os.cliente_id = c.id
        INNER JOIN Usuario u ON os.usuario_id = u.id
        WHERE os.id = ?`,
        [id]
      );

      if (!os) {
        return res.status(404).json({
          success: false,
          message: 'Ordem de Serviço não encontrada.'
        });
      }

      os.itens = await dbAsync.all(
        `SELECT id, descricao, quantidade, valor_unitario, (quantidade * valor_unitario) AS subtotal
         FROM ItemServico
         WHERE ordem_servico_id = ?
         ORDER BY id ASC`,
        [id]
      );

      return res.status(200).json({
        success: true,
        data: os
      });
    } catch (error) {
      console.error('[-] Erro ao buscar OS por ID:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar os dados da OS.',
        error: error.message
      });
    }
  },

  /**
   * POST /api/os
   * Cria uma nova Ordem de Serviço com transação atômica (BEGIN, COMMIT, ROLLBACK).
   * Realiza o cálculo automático do valor total somando mão de obra + soma dos itens.
   */
  async criarOS(req, res) {
    try {
      const {
        cliente_id,
        usuario_id = 1,
        equipamento,
        defeito_relatado,
        laudo_tecnico = '',
        status = 'Recebido',
        valor_mao_obra = 0,
        itens = []
      } = req.body;

      // Validações básicas de preenchimento
      if (!cliente_id || !equipamento || !defeito_relatado) {
        return res.status(400).json({
          success: false,
          message: 'Cliente, Equipamento e Defeito Relatado são campos obrigatórios.'
        });
      }

      // Validação se o cliente realmente existe
      const clienteExistente = await dbAsync.get('SELECT id FROM Cliente WHERE id = ?', [cliente_id]);
      if (!clienteExistente) {
        return res.status(404).json({
          success: false,
          message: 'O cliente selecionado não foi encontrado no sistema.'
        });
      }

      // Cálculo Automático do Total:
      // Mão de Obra + Soma de (Quantidade * Valor Unitário) de cada item
      const valorMaoObraNum = Math.max(0, parseFloat(valor_mao_obra) || 0);
      let totalItens = 0;
      const itensValidados = [];

      if (Array.isArray(itens) && itens.length > 0) {
        for (const item of itens) {
          if (item.descricao && item.descricao.trim() !== '') {
            const quantidade = Math.max(1, parseInt(item.quantidade, 10) || 1);
            const valorUnitario = Math.max(0, parseFloat(item.valor_unitario) || 0);
            totalItens += quantidade * valorUnitario;

            itensValidados.push({
              descricao: item.descricao.trim(),
              quantidade,
              valor_unitario: valorUnitario
            });
          }
        }
      }

      const valorTotal = Number((valorMaoObraNum + totalItens).toFixed(2));

      // Inicia Transação no SQLite
      await dbAsync.run('BEGIN TRANSACTION');

      try {
        // Insere a Ordem de Serviço
        const osResult = await dbAsync.run(
          `INSERT INTO OrdemServico (
            cliente_id,
            usuario_id,
            equipamento,
            defeito_relatado,
            laudo_tecnico,
            status,
            valor_mao_obra,
            valor_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cliente_id,
            usuario_id,
            equipamento.trim(),
            defeito_relatado.trim(),
            laudo_tecnico ? laudo_tecnico.trim() : null,
            status,
            valorMaoObraNum,
            valorTotal
          ]
        );

        const ordemServicoId = osResult.id;

        // Insere os itens vinculados à OS criada
        for (const item of itensValidados) {
          await dbAsync.run(
            `INSERT INTO ItemServico (ordem_servico_id, descricao, quantidade, valor_unitario)
             VALUES (?, ?, ?, ?)`,
            [ordemServicoId, item.descricao, item.quantidade, item.valor_unitario]
          );
        }

        // Confirma a transação com sucesso
        await dbAsync.run('COMMIT');

        return res.status(201).json({
          success: true,
          message: `Ordem de Serviço #${ordemServicoId} cadastrada com sucesso!`,
          data: {
            id: ordemServicoId,
            valor_mao_obra: valorMaoObraNum,
            total_itens: totalItens,
            valor_total: valorTotal,
            itens_cadastrados: itensValidados.length
          }
        });
      } catch (transError) {
        // Em caso de falha, desfaz todas as inserções pendentes
        await dbAsync.run('ROLLBACK');
        throw transError;
      }
    } catch (error) {
      console.error('[-] Erro ao criar Ordem de Serviço:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao gravar a Ordem de Serviço.',
        error: error.message
      });
    }
  },

  /**
   * PATCH /api/os/:id/status
   * Atualiza o status e opcionalmente o laudo técnico da OS.
   * Se o novo status for 'Concluído', atualiza automaticamente a data_finalizacao.
   */
  async atualizarStatusOS(req, res) {
    try {
      const { id } = req.params;
      const { status, laudo_tecnico } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status é obrigatório para atualização.'
        });
      }

      const osAtual = await dbAsync.get('SELECT id, status FROM OrdemServico WHERE id = ?', [id]);
      if (!osAtual) {
        return res.status(404).json({
          success: false,
          message: 'Ordem de Serviço não encontrada.'
        });
      }

      // Se mudar para Concluído, preenche data_finalizacao
      let sqlUpdate = `UPDATE OrdemServico SET status = ?`;
      const params = [status];

      if (status === 'Concluído') {
        sqlUpdate += `, data_finalizacao = datetime('now', 'localtime')`;
      } else {
        sqlUpdate += `, data_finalizacao = NULL`;
      }

      if (laudo_tecnico !== undefined) {
        sqlUpdate += `, laudo_tecnico = ?`;
        params.push(laudo_tecnico.trim());
      }

      sqlUpdate += ` WHERE id = ?`;
      params.push(id);

      await dbAsync.run(sqlUpdate, params);

      return res.status(200).json({
        success: true,
        message: `Status da OS #${id} alterado para "${status}" com sucesso!`
      });
    } catch (error) {
      console.error('[-] Erro ao atualizar status da OS:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar o status da OS.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/os/resumo
   * Retorna os dados agregados para os cards de KPI do dashboard:
   * Total de OSs, quantidade por status e faturamento total.
   */
  async obterResumo(req, res) {
    try {
      const totalGeral = await dbAsync.get(`SELECT COUNT(*) AS total, IFNULL(SUM(valor_total), 0) AS faturamento FROM OrdemServico`);
      const recebidos = await dbAsync.get(`SELECT COUNT(*) AS total FROM OrdemServico WHERE status = 'Recebido'`);
      const emAnalise = await dbAsync.get(`SELECT COUNT(*) AS total FROM OrdemServico WHERE status = 'Em Análise'`);
      const aguardandoPeca = await dbAsync.get(`SELECT COUNT(*) AS total FROM OrdemServico WHERE status = 'Aguardando Peça'`);
      const concluidos = await dbAsync.get(`SELECT COUNT(*) AS total FROM OrdemServico WHERE status = 'Concluído'`);
      const clientesTotal = await dbAsync.get(`SELECT COUNT(*) AS total FROM Cliente`);

      return res.status(200).json({
        success: true,
        data: {
          total_os: totalGeral.total || 0,
          faturamento_total: Number(totalGeral.faturamento || 0).toFixed(2),
          recebidos: recebidos.total || 0,
          em_analise: emAnalise.total || 0,
          aguardando_peca: aguardandoPeca.total || 0,
          concluidos: concluidos.total || 0,
          total_clientes: clientesTotal.total || 0
        }
      });
    } catch (error) {
      console.error('[-] Erro ao obter resumo da dashboard:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao consultar o resumo do sistema.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/clientes
   * Retorna a lista de todos os clientes cadastrados.
   */
  async listarClientes(req, res) {
    try {
      const clientes = await dbAsync.all(
        `SELECT id, nome, cpf, telefone, email 
         FROM Cliente 
         ORDER BY nome ASC`
      );

      return res.status(200).json({
        success: true,
        data: clientes
      });
    } catch (error) {
      console.error('[-] Erro ao listar clientes:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao listar clientes.',
        error: error.message
      });
    }
  },

  /**
   * POST /api/clientes
   * Cadastra um novo cliente com validação de unicidade de CPF.
   */
  async cadastrarCliente(req, res) {
    try {
      const { nome, cpf, telefone, email } = req.body;

      if (!nome || !cpf) {
        return res.status(400).json({
          success: false,
          message: 'Nome e CPF são campos obrigatórios.'
        });
      }

      // Limpeza de caracteres não numéricos para validação
      const cpfLimpo = cpf.trim();

      // Checa se já existe cliente com o mesmo CPF
      const existente = await dbAsync.get('SELECT id FROM Cliente WHERE cpf = ?', [cpfLimpo]);
      if (existente) {
        return res.status(409).json({
          success: false,
          message: `Já existe um cliente cadastrado com o CPF ${cpfLimpo}.`
        });
      }

      const result = await dbAsync.run(
        `INSERT INTO Cliente (nome, cpf, telefone, email) VALUES (?, ?, ?, ?)`,
        [nome.trim(), cpfLimpo, telefone ? telefone.trim() : null, email ? email.trim() : null]
      );

      return res.status(201).json({
        success: true,
        message: `Cliente "${nome.trim()}" cadastrado com sucesso!`,
        data: {
          id: result.id,
          nome: nome.trim(),
          cpf: cpfLimpo
        }
      });
    } catch (error) {
      console.error('[-] Erro ao cadastrar cliente:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao cadastrar cliente.',
        error: error.message
      });
    }
  }
};

module.exports = osController;

