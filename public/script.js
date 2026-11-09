/**
 * public/script.js
 * Lógica Front-end do FixDesk:
 * - Máscaras nativas de CPF e Telefone (bloqueio de caracteres não numéricos)
 * - Requisições assíncronas Fetch para a API Express
 * - Adição dinâmica de itens/peças e cálculo automático do valor total em tempo real
 * - Filtro de status e busca textual integrados ao backend
 * - Feedback visual (Toasts do Bootstrap) e reset automático de formulários
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inicialização dos elementos e instâncias
  inicializarMascaras();
  configurarEventosFormularios();
  configurarFiltrosEBusca();
  configurarGerenciadorItensOS();
  
  // Carregamento inicial de dados
  carregarClientesSelect();
  carregarResumoDashboard();
  carregarOrdensServico();
});

/* =========================================================================
   1. MÁSCARAS DE INPUT NATIVAS (CPF E TELEFONE)
   ========================================================================= */

function inicializarMascaras() {
  const campoCPF = document.getElementById('clienteCPF');
  const campoTelefone = document.getElementById('clienteTelefone');

  // Máscara de CPF: 000.000.000-00 (impede letras e caracteres especiais)
  if (campoCPF) {
    campoCPF.addEventListener('input', (e) => {
      // Remove qualquer caractere que não seja dígito
      let valor = e.target.value.replace(/\D/g, '');

      // Limita a 11 dígitos
      if (valor.length > 11) {
        valor = valor.slice(0, 11);
      }

      // Aplica a formatação 000.000.000-00
      if (valor.length > 9) {
        valor = valor.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
      } else if (valor.length > 6) {
        valor = valor.replace(/^(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      } else if (valor.length > 3) {
        valor = valor.replace(/^(\d{3})(\d{1,3})/, '$1.$2');
      }

      e.target.value = valor;
    });

    // Impede a digitação de caracteres alfabéticos no keypress
    campoCPF.addEventListener('keypress', (e) => {
      if (!/\d/.test(e.key)) {
        e.preventDefault();
      }
    });
  }

  // Máscara de Telefone: (00) 00000-0000 ou (00) 0000-0000
  if (campoTelefone) {
    campoTelefone.addEventListener('input', (e) => {
      let valor = e.target.value.replace(/\D/g, '');

      if (valor.length > 11) {
        valor = valor.slice(0, 11);
      }

      if (valor.length > 10) {
        valor = valor.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (valor.length > 6) {
        valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else if (valor.length > 2) {
        valor = valor.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
      }

      e.target.value = valor;
    });
  }
}

/* =========================================================================
   2. FEEDBACK VISUAL (TOAST BOOTSTRAP) E UTILITÁRIOS
   ========================================================================= */

function exibirFeedback(tipo, titulo, mensagem) {
  const toastEl = document.getElementById('feedbackToast');
  const toastTitulo = document.getElementById('toastTitulo');
  const toastMensagem = document.getElementById('toastMensagem');
  const toastIcon = document.getElementById('toastIcon');

  // Ajusta cores e ícones conforme o tipo (success, danger, warning, info)
  toastEl.className = 'toast align-items-center text-white border-0 shadow';
  if (tipo === 'success') {
    toastEl.classList.add('bg-success');
    toastIcon.className = 'bi bi-check-circle-fill fs-5';
  } else if (tipo === 'danger') {
    toastEl.classList.add('bg-danger');
    toastIcon.className = 'bi bi-exclamation-triangle-fill fs-5';
  } else if (tipo === 'warning') {
    toastEl.classList.add('bg-warning', 'text-dark');
    toastIcon.className = 'bi bi-exclamation-circle-fill fs-5';
  } else {
    toastEl.classList.add('bg-primary');
    toastIcon.className = 'bi bi-info-circle-fill fs-5';
  }

  toastTitulo.textContent = titulo;
  toastMensagem.textContent = mensagem;

  const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
  bsToast.show();
}

function formatarMoeda(valor) {
  const num = parseFloat(valor) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO) {
  if (!dataISO) return '-';
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) return dataISO;
  return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function obterBadgeStatusHtml(status) {
  switch (status) {
    case 'Recebido':
      return `<span class="badge badge-status-recebido"><i class="bi bi-inbox me-1"></i>Recebido</span>`;
    case 'Em Análise':
      return `<span class="badge badge-status-em-analise"><i class="bi bi-cpu me-1"></i>Em Análise</span>`;
    case 'Aguardando Peça':
      return `<span class="badge badge-status-aguardando-peca"><i class="bi bi-hourglass-split me-1"></i>Aguardando Peça</span>`;
    case 'Concluído':
      return `<span class="badge badge-status-concluido"><i class="bi bi-check2-circle me-1"></i>Concluído</span>`;
    default:
      return `<span class="badge bg-secondary">${status}</span>`;
  }
}

/* =========================================================================
   3. CÁLCULO AUTOMÁTICO DE VALORES E GERENCIAMENTO DE ITENS DA OS
   ========================================================================= */

function configurarGerenciadorItensOS() {
  const btnAdicionarItem = document.getElementById('btnAdicionarItem');
  const corpoItensOS = document.getElementById('corpoItensOS');
  const inputMaoObra = document.getElementById('osMaoObra');

  // Adiciona nova linha de peça/item
  btnAdicionarItem.addEventListener('click', () => {
    adicionarLinhaItem();
  });

  // Atualiza o total ao alterar o valor da mão de obra
  inputMaoObra.addEventListener('input', () => {
    calcularTotalOS();
  });

  // Adiciona uma linha em branco por padrão ao abrir
  adicionarLinhaItem('Diagnóstico / Peça de reposição', 1, 0.00);
}

function adicionarLinhaItem(descricaoPadrao = '', qtdPadrao = 1, precoPadrao = 0) {
  const corpoItensOS = document.getElementById('corpoItensOS');
  const tr = document.createElement('tr');
  tr.className = 'linha-item-os';

  tr.innerHTML = `
    <td>
      <input type="text" class="form-control form-control-sm item-descricao" placeholder="Ex: SSD 480GB, Troca de Tela..." value="${descricaoPadrao}" required>
    </td>
    <td>
      <input type="number" min="1" step="1" class="form-control form-control-sm text-center item-quantidade" value="${qtdPadrao}" required>
    </td>
    <td>
      <div class="input-group input-group-sm">
        <span class="input-group-text">R$</span>
        <input type="number" min="0" step="0.01" class="form-control form-control-sm text-end item-valor-unitario" value="${parseFloat(precoPadrao).toFixed(2)}" required>
      </div>
    </td>
    <td class="text-end fw-semibold item-subtotal-texto">
      ${formatarMoeda(qtdPadrao * precoPadrao)}
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-outline-danger btn-sm py-0 px-2 btn-remover-item" title="Remover item">
        <i class="bi bi-trash"></i>
      </button>
    </td>
  `;

  // Eventos de recálculo dinâmico nos inputs da nova linha
  const inputQtd = tr.querySelector('.item-quantidade');
  const inputPreco = tr.querySelector('.item-valor-unitario');
  const btnRemover = tr.querySelector('.btn-remover-item');

  const atualizarSubtotal = () => {
    const qtd = Math.max(1, parseInt(inputQtd.value, 10) || 1);
    const preco = Math.max(0, parseFloat(inputPreco.value) || 0);
    const subtotal = qtd * preco;
    tr.querySelector('.item-subtotal-texto').textContent = formatarMoeda(subtotal);
    calcularTotalOS();
  };

  inputQtd.addEventListener('input', atualizarSubtotal);
  inputPreco.addEventListener('input', atualizarSubtotal);

  btnRemover.addEventListener('click', () => {
    tr.remove();
    calcularTotalOS();
  });

  corpoItensOS.appendChild(tr);
  calcularTotalOS();
}

/**
 * Cálculo Automático: Mão de Obra + Soma de (Quantidade * Valor Unitário) de cada item
 */
function calcularTotalOS() {
  const inputMaoObra = document.getElementById('osMaoObra');
  const maoDeObra = parseFloat(inputMaoObra.value) || 0;

  const linhas = document.querySelectorAll('.linha-item-os');
  let totalItens = 0;

  linhas.forEach((tr) => {
    const qtd = parseInt(tr.querySelector('.item-quantidade').value, 10) || 0;
    const preco = parseFloat(tr.querySelector('.item-valor-unitario').value) || 0;
    totalItens += (qtd * preco);
  });

  const totalGeral = maoDeObra + totalItens;
  document.getElementById('lblTotalGeralCalculado').textContent = formatarMoeda(totalGeral);
  return { maoDeObra, totalItens, totalGeral };
}

/* =========================================================================
   4. EVENTOS DE FORMULÁRIO (CRIAÇÃO DE OS E CADASTRO DE CLIENTE)
   ========================================================================= */

function configurarEventosFormularios() {
  const formNovoCliente = document.getElementById('formNovoCliente');
  const formNovaOS = document.getElementById('formNovaOS');

  // --- Submissão do Formulário de Cliente ---
  formNovoCliente.addEventListener('submit', async (e) => {
    e.preventDefault();

    const dados = {
      nome: document.getElementById('clienteNome').value.trim(),
      cpf: document.getElementById('clienteCPF').value.trim(),
      telefone: document.getElementById('clienteTelefone').value.trim(),
      email: document.getElementById('clienteEmail').value.trim()
    };

    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      const resultado = await response.json();

      if (!response.ok || !resultado.success) {
        throw new Error(resultado.message || 'Falha ao cadastrar cliente.');
      }

      // Feedback visual e limpeza do formulário (conforme requisito)
      exibirFeedback('success', 'Cliente Cadastrado!', resultado.message);
      formNovoCliente.reset();

      // Fecha o modal de cliente
      const modalClienteEl = document.getElementById('modalNovoCliente');
      const bsModalCliente = bootstrap.Modal.getInstance(modalClienteEl);
      if (bsModalCliente) bsModalCliente.hide();

      // Atualiza o select de clientes e seleciona o recém-cadastrado
      await carregarClientesSelect(resultado.data.id);
      carregarResumoDashboard();

    } catch (error) {
      console.error('[-] Erro ao salvar cliente:', error);
      exibirFeedback('danger', 'Erro no Cadastro', error.message);
    }
  });

  // --- Submissão do Formulário de Nova OS ---
  formNovaOS.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Coleta dos itens dinâmicos
    const itens = [];
    const linhas = document.querySelectorAll('.linha-item-os');
    linhas.forEach((tr) => {
      const descricao = tr.querySelector('.item-descricao').value.trim();
      const quantidade = parseInt(tr.querySelector('.item-quantidade').value, 10) || 1;
      const valor_unitario = parseFloat(tr.querySelector('.item-valor-unitario').value) || 0;

      if (descricao) {
        itens.push({ descricao, quantidade, valor_unitario });
      }
    });

    const dadosOS = {
      cliente_id: parseInt(document.getElementById('osClienteSelect').value, 10),
      usuario_id: 1, // Usuário padrão do sistema
      equipamento: document.getElementById('osEquipamento').value.trim(),
      defeito_relatado: document.getElementById('osDefeito').value.trim(),
      laudo_tecnico: document.getElementById('osLaudo').value.trim(),
      status: document.getElementById('osStatusSelect').value,
      valor_mao_obra: parseFloat(document.getElementById('osMaoObra').value) || 0,
      itens: itens
    };

    try {
      const response = await fetch('/api/os', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosOS)
      });

      const resultado = await response.json();

      if (!response.ok || !resultado.success) {
        throw new Error(resultado.message || 'Falha ao registrar Ordem de Serviço.');
      }

      // Feedback visual e limpeza do formulário (conforme requisito)
      exibirFeedback('success', 'OS Cadastrada!', resultado.message);
      formNovaOS.reset();

      // Limpa os itens dinâmicos e reinicia com uma linha limpa
      document.getElementById('corpoItensOS').innerHTML = '';
      adicionarLinhaItem('Diagnóstico / Peça de reposição', 1, 0.00);
      calcularTotalOS();

      // Fecha o modal de OS
      const modalOSEl = document.getElementById('modalNovaOS');
      const bsModalOS = bootstrap.Modal.getInstance(modalOSEl);
      if (bsModalOS) bsModalOS.hide();

      // Atualiza listagem e indicadores
      carregarOrdensServico();
      carregarResumoDashboard();

    } catch (error) {
      console.error('[-] Erro ao salvar OS:', error);
      exibirFeedback('danger', 'Erro na Gravação', error.message);
    }
  });

  // Configuração do botão de atualização de status do modal de detalhes
  const btnConfirmarStatus = document.getElementById('btnConfirmarAtualizacaoStatus');
  if (btnConfirmarStatus) {
    btnConfirmarStatus.addEventListener('click', async () => {
      const osId = document.getElementById('detalheOSId').textContent;
      const novoStatus = document.getElementById('selectAtualizarStatus').value;
      const novoLaudo = document.getElementById('detalheLaudoInput').value;

      try {
        const response = await fetch(`/api/os/${osId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: novoStatus, laudo_tecnico: novoLaudo })
        });

        const resultado = await response.json();
        if (!response.ok || !resultado.success) {
          throw new Error(resultado.message || 'Falha ao atualizar status.');
        }

        exibirFeedback('success', 'Status Atualizado', resultado.message);

        // Fecha o modal de detalhes
        const modalDetalheEl = document.getElementById('modalDetalhesOS');
        const bsModalDetalhes = bootstrap.Modal.getInstance(modalDetalheEl);
        if (bsModalDetalhes) bsModalDetalhes.hide();

        // Recarrega dados
        carregarOrdensServico();
        carregarResumoDashboard();
      } catch (error) {
        console.error('[-] Erro ao atualizar status:', error);
        exibirFeedback('danger', 'Erro na Atualização', error.message);
      }
    });
  }
}

/* =========================================================================
   5. FILTROS E BUSCA INTEGRADOS AO CONTROLLER
   ========================================================================= */

function configurarFiltrosEBusca() {
  const filtroStatus = document.getElementById('filtroStatus');
  const campoBusca = document.getElementById('campoBusca');
  const btnLimparBusca = document.getElementById('btnLimparBusca');
  const btnRecarregar = document.getElementById('btnRecarregar');

  // Filtro por status
  filtroStatus.addEventListener('change', () => {
    carregarOrdensServico();
  });

  // Busca rápida ao pressionar Enter ou digitar com debounce
  let timeoutBusca = null;
  campoBusca.addEventListener('input', () => {
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
      carregarOrdensServico();
    }, 350);
  });

  // Limpar campo de busca
  btnLimparBusca.addEventListener('click', () => {
    campoBusca.value = '';
    carregarOrdensServico();
  });

  // Recarregar geral
  btnRecarregar.addEventListener('click', () => {
    carregarOrdensServico();
    carregarResumoDashboard();
    carregarClientesSelect();
    exibirFeedback('info', 'Dados Atualizados', 'Informações sincronizadas com o banco SQLite.');
  });
}

/* =========================================================================
   6. CARREGAMENTO E RENDERIZAÇÃO DA API
   ========================================================================= */

/**
 * Carrega a lista de clientes para alimentar o <select> da OS
 */
async function carregarClientesSelect(clienteSelecionadoId = null) {
  try {
    const response = await fetch('/api/clientes');
    const resultado = await response.json();

    if (!resultado.success) return;

    const select = document.getElementById('osClienteSelect');
    select.innerHTML = '<option value="" selected disabled>Selecione um cliente cadastrado...</option>';

    resultado.data.forEach((c) => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = `${c.nome} (CPF: ${c.cpf})`;
      if (clienteSelecionadoId && c.id === clienteSelecionadoId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  } catch (error) {
    console.error('[-] Erro ao carregar clientes:', error);
  }
}

/**
 * Carrega os KPIs para os cards de resumo
 */
async function carregarResumoDashboard() {
  try {
    const response = await fetch('/api/os/resumo');
    const resultado = await response.json();

    if (!resultado.success) return;

    const kpi = resultado.data;
    document.getElementById('kpiTotalOS').textContent = kpi.total_os;
    document.getElementById('kpiTotalClientes').textContent = `${kpi.total_clientes} clientes`;
    document.getElementById('kpiRecebidos').textContent = kpi.recebidos;
    document.getElementById('kpiEmAnalise').textContent = kpi.em_analise;
    document.getElementById('kpiAguardandoPeca').textContent = kpi.aguardando_peca;
    document.getElementById('kpiConcluidos').textContent = kpi.concluidos;
    document.getElementById('kpiFaturamento').textContent = formatarMoeda(kpi.faturamento_total);
  } catch (error) {
    console.error('[-] Erro ao carregar KPIs do resumo:', error);
  }
}

/**
 * Carrega a listagem de Ordens de Serviço aplicando status e busca
 */
async function carregarOrdensServico() {
  const tabelaCorpo = document.getElementById('tabelaOSCorpo');
  const badgeContador = document.getElementById('badgeContadorOS');
  const statusSelecionado = document.getElementById('filtroStatus').value;
  const termoBusca = document.getElementById('campoBusca').value.trim();

  // Monta a URL com os filtros para o Controller
  const params = new URLSearchParams();
  if (statusSelecionado && statusSelecionado !== 'Todos') {
    params.append('status', statusSelecionado);
  }
  if (termoBusca) {
    params.append('busca', termoBusca);
  }

  const url = `/api/os?${params.toString()}`;

  try {
    const response = await fetch(url);
    const resultado = await response.json();

    if (!resultado.success) {
      throw new Error(resultado.message || 'Falha ao carregar ordens de serviço.');
    }

    const ordens = resultado.data;
    badgeContador.textContent = `${ordens.length} registro(s) encontrado(s)`;

    if (ordens.length === 0) {
      tabelaCorpo.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5 text-muted">
            <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
            Nenhuma Ordem de Serviço encontrada com os critérios selecionados.
          </td>
        </tr>
      `;
      return;
    }

    tabelaCorpo.innerHTML = '';

    ordens.forEach((os) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td class="ps-3 fw-bold text-primary">#${os.id}</td>
        <td>
          <div class="fw-semibold text-dark">${os.cliente_nome}</div>
          <small class="text-muted"><i class="bi bi-card-text me-1"></i>${os.cliente_cpf}</small>
        </td>
        <td>
          <span class="fw-medium">${os.equipamento}</span>
        </td>
        <td>
          <span class="d-inline-block text-truncate" style="max-width: 250px;" title="${os.defeito_relatado}">
            ${os.defeito_relatado}
          </span>
        </td>
        <td>${obterBadgeStatusHtml(os.status)}</td>
        <td>${formatarMoeda(os.valor_mao_obra)}</td>
        <td class="fw-bold text-success">${formatarMoeda(os.valor_total)}</td>
        <td class="small text-muted">${formatarData(os.data_abertura)}</td>
        <td class="text-center pe-3">
          <button class="btn btn-outline-primary btn-sm btn-ver-detalhes" data-id="${os.id}" title="Ver Detalhes e Atualizar">
            <i class="bi bi-eye"></i> Detalhes
          </button>
        </td>
      `;

      // Evento de clique no botão de detalhes
      const btnDetalhes = tr.querySelector('.btn-ver-detalhes');
      btnDetalhes.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirModalDetalhes(os.id);
      });

      // Clique na linha também abre os detalhes
      tr.addEventListener('click', () => {
        abrirModalDetalhes(os.id);
      });

      tabelaCorpo.appendChild(tr);
    });

  } catch (error) {
    console.error('[-] Erro ao carregar tabela de OS:', error);
    tabelaCorpo.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-octagon fs-3 d-block mb-1"></i>
          Ocorreu um erro ao carregar as Ordens de Serviço: ${error.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Abre o Modal com todos os dados da OS e seus respectivos itens
 */
async function abrirModalDetalhes(osId) {
  try {
    const response = await fetch(`/api/os/${osId}`);
    const resultado = await response.json();

    if (!resultado.success || !resultado.data) {
      throw new Error('Não foi possível carregar os dados desta Ordem de Serviço.');
    }

    const os = resultado.data;

    // Preenche dados do modal
    document.getElementById('detalheOSId').textContent = os.id;
    document.getElementById('detalheOSBadgeStatus').className = 'badge';
    document.getElementById('detalheOSBadgeStatus').innerHTML = obterBadgeStatusHtml(os.status);

    document.getElementById('detalheClienteNome').textContent = os.cliente_nome;
    document.getElementById('detalheClienteCPF').textContent = os.cliente_cpf;
    document.getElementById('detalheClienteTelefone').textContent = os.cliente_telefone || 'Não informado';
    document.getElementById('detalheClienteEmail').textContent = os.cliente_email || 'Não informado';

    document.getElementById('detalheEquipamento').textContent = os.equipamento;
    document.getElementById('detalheUsuario').textContent = os.usuario_nome;
    document.getElementById('detalheDataAbertura').textContent = formatarData(os.data_abertura);
    document.getElementById('detalheDataFinalizacao').textContent = os.data_finalizacao ? formatarData(os.data_finalizacao) : 'Em aberto';

    document.getElementById('detalheDefeito').textContent = os.defeito_relatado;
    document.getElementById('detalheLaudoInput').value = os.laudo_tecnico || '';

    document.getElementById('selectAtualizarStatus').value = os.status;
    document.getElementById('detalheMaoObra').textContent = formatarMoeda(os.valor_mao_obra);
    document.getElementById('detalheValorTotal').textContent = formatarMoeda(os.valor_total);

    // Preenche a tabela de itens
    const corpoItens = document.getElementById('detalheTabelaItensCorpo');
    corpoItens.innerHTML = '';

    if (os.itens && os.itens.length > 0) {
      os.itens.forEach((it) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${it.descricao}</td>
          <td class="text-center">${it.quantidade}</td>
          <td class="text-end">${formatarMoeda(it.valor_unitario)}</td>
          <td class="text-end fw-semibold">${formatarMoeda(it.subtotal)}</td>
        `;
        corpoItens.appendChild(tr);
      });
    } else {
      corpoItens.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted small py-2">
            Nenhuma peça ou item adicional registrado nesta OS.
          </td>
        </tr>
      `;
    }

    // Exibe o modal
    const modalEl = document.getElementById('modalDetalhesOS');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

  } catch (error) {
    console.error('[-] Erro ao abrir detalhes da OS:', error);
    exibirFeedback('danger', 'Erro ao Visualizar OS', error.message);
  }
}

