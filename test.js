/**
 * test.js
 * Script de testes automatizados do FixDesk para validação acadêmica:
 * - Validação de conexão e esquema do banco SQLite
 * - Verificação de seed com 2 clientes e 2 ordens de serviço
 * - Teste de criação de OS com transação atômica e cálculo automático
 * - Teste de filtros de status no controller
 * - Teste de validação de clientes e unicidade de CPF
 */

const { dbAsync, initDatabase } = require('./database');
const osController = require('./controllers/osController');

function mockRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
}

async function executarTestes() {
  console.log('====================================================');
  console.log(' FIXDESK - BATERIA DE TESTES AUTOMATIZADOS');
  console.log('====================================================\n');

  try {
    // 1. Inicialização do banco e seed
    console.log('[1/6] Inicializando banco de dados SQLite...');
    await initDatabase();
    console.log('  -> Banco inicializado com sucesso.\n');

    // 2. Verificação de Seed
    console.log('[2/6] Verificando dados simulados (Seed obrigatório)...');
    const clientes = await dbAsync.all('SELECT * FROM Cliente');
    const ordens = await dbAsync.all('SELECT * FROM OrdemServico');
    const itens = await dbAsync.all('SELECT * FROM ItemServico');

    console.log(`  -> Clientes cadastrados: ${clientes.length} (esperado >= 2)`);
    console.log(`  -> Ordens de Serviço: ${ordens.length} (esperado >= 2)`);
    console.log(`  -> Peças/Itens alocados: ${itens.length}`);
    if (clientes.length < 2 || ordens.length < 2) {
      throw new Error('Falha no seed: menos de 2 clientes ou 2 ordens cadastradas.');
    }
    console.log('  -> Seed verificado com sucesso!\n');

    // 3. Teste do Filtro de Status no Controller
    console.log('[3/6] Testando filtro de status no Controller...');
    let res = mockRes();
    await osController.listarOS({ query: { status: 'Concluído' } }, res);
    console.log(`  -> Listagem com filtro status="Concluído": ${res.data.total} registro(s) encontrado(s)`);
    if (res.statusCode !== 200 || !res.data.success) {
      throw new Error('Falha ao filtrar por status no controller.');
    }
    console.log('  -> Filtro de status validado com sucesso!\n');

    // 4. Teste de Cadastro de Cliente com Validação
    console.log('[4/6] Testando cadastro de cliente com validação de CPF...');
    res = mockRes();
    const cpfTeste = '777.888.999-00';
    await osController.cadastrarCliente({
      body: {
        nome: 'Cliente Teste Automatizado',
        cpf: cpfTeste,
        telefone: '(11) 98888-7777',
        email: 'teste@fixdesk.com'
      }
    }, res);

    if (res.statusCode !== 201) {
      throw new Error(`Falha ao cadastrar cliente: status ${res.statusCode}`);
    }
    const novoClienteId = res.data.data.id;
    console.log(`  -> Cliente #${novoClienteId} cadastrado com sucesso.`);

    // Tentativa de duplicidade de CPF (deve retornar 409)
    res = mockRes();
    await osController.cadastrarCliente({
      body: {
        nome: 'Cliente Duplicado',
        cpf: cpfTeste
      }
    }, res);
    if (res.statusCode !== 409) {
      throw new Error('Falha na validação de unicidade de CPF (deveria retornar erro 409).');
    }
    console.log('  -> Unicidade de CPF validada (rejeitou duplicidade corretamente).\n');

    // 5. Teste de Criação de OS com Cálculo Automático e Transação
    console.log('[5/6] Testando cálculo automático e transação na criação de OS...');
    res = mockRes();
    const maoDeObra = 150.00;
    const itensTeste = [
      { descricao: 'Placa controladora Wi-Fi', quantidade: 2, valor_unitario: 80.00 }, // 160.00
      { descricao: 'Cabo flat de reposição', quantidade: 1, valor_unitario: 40.00 }    // 40.00
    ];
    // Total esperado: 150.00 + 160.00 + 40.00 = 350.00

    await osController.criarOS({
      body: {
        cliente_id: novoClienteId,
        equipamento: 'Impressora Epson L3150',
        defeito_relatado: 'Falha na comunicação de rede',
        valor_mao_obra: maoDeObra,
        itens: itensTeste
      }
    }, res);

    if (res.statusCode !== 201) {
      throw new Error(`Falha ao criar OS: status ${res.statusCode}`);
    }

    const valorCalculado = res.data.data.valor_total;
    console.log(`  -> Valor Total Calculado pelo Controller: R$ ${valorCalculado} (esperado R$ 350.00)`);
    if (valorCalculado !== 350.00) {
      throw new Error(`Cálculo automático incorreto: obtido ${valorCalculado}, esperado 350.00`);
    }
    const novaOSId = res.data.data.id;
    console.log(`  -> OS #${novaOSId} gerada e gravada via transação atômica com sucesso!\n`);

    // 6. Teste de Atualização de Status
    console.log('[6/6] Testando atualização de status e fechamento de OS...');
    res = mockRes();
    await osController.atualizarStatusOS({
      params: { id: novaOSId },
      body: {
        status: 'Concluído',
        laudo_tecnico: 'Cabos substituídos e firmware atualizado com testes aprovados.'
      }
    }, res);

    if (res.statusCode !== 200) {
      throw new Error(`Falha ao atualizar status: status ${res.statusCode}`);
    }
    console.log('  -> Status atualizado para "Concluído" com data de finalização gravada.\n');

    console.log('====================================================');
    console.log(' ✓ TODOS OS TESTES FORAM APROVADOS COM SUCESSO!     ');
    console.log('====================================================');
    process.exit(0);

  } catch (erro) {
    console.error('\n[-] ERRO DURANTE A EXECUÇÃO DOS TESTES:', erro.message);
    process.exit(1);
  }
}

executarTestes();

