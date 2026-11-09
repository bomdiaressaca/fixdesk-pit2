# FixDesk - Sistema de Gestão de Ordens de Serviço (OS)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4.19.2-blue.svg)](https://expressjs.com/)
[![SQLite3](https://img.shields.io/badge/SQLite3-v5.1.7-lightgrey.svg)](https://www.sqlite.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.3-purple.svg)](https://getbootstrap.com/)

O **FixDesk** é uma aplicação web completa desenvolvida para a gestão e acompanhamento de Ordens de Serviço (OS) em assistências técnicas e laboratórios de manutenção. Segue o padrão de arquitetura **MVC** (Model-View-Controller) com banco de dados relacional embarcado **SQLite**, sendo **100% plug-and-play** (sem necessidade de configurar banco de dados externo).

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** instalado (versão 18 ou superior).

### Instalação e Execução

1. Abra o terminal na pasta do projeto:
   ```bash
   cd fixdesk-pit2
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor:
   ```bash
   npm start
   ```

4. Acesse a aplicação no seu navegador:
   👉 **http://localhost:3000**

> **Observação:** Na primeira inicialização, o arquivo `fixdesk.db` é gerado automaticamente com o esquema de tabelas e alimentado com **dados simulados (seed)** contendo 2 clientes e 2 ordens de serviço completas.

---

## 🏛️ Arquitetura MVC & Estrutura de Arquivos

```text
fixdesk-pit2/
├── controllers/
│   └── osController.js       # Regras de negócio, transações, filtros e cálculos
├── public/
│   ├── index.html            # Interface moderna com Bootstrap 5 (tabelas responsivas)
│   ├── script.js             # Validações, máscaras nativas, cálculo em tempo real e fetch
│   └── style.css             # Estilos e customizações complementares
├── database.js               # Conexão SQLite, DDL de tabelas e seed automático
├── server.js                 # Servidor Express, rotas da API e arquivos estáticos
├── package.json              # Dependências e scripts de execução (npm start)
└── README.md                 # Documentação completa do projeto
```

---

## 🗄️ Esquema Relacional do Banco de Dados (SQLite)

O banco é criado com `PRAGMA foreign_keys = ON` e possui o seguinte esquema:

- **Usuario**: Técnicos e administradores (`id`, `nome`, `email`, `senha_hash`, `perfil`).
- **Cliente**: Proprietários dos equipamentos (`id`, `nome`, `cpf`, `telefone`, `email`).
- **OrdemServico**: Atendimento técnico (`id`, `cliente_id`, `usuario_id`, `equipamento`, `defeito_relatado`, `laudo_tecnico`, `status`, `valor_mao_obra`, `valor_total`, `data_abertura`, `data_finalizacao`).
- **ItemServico**: Peças e serviços unitários vinculados à OS com exclusão em cascata (`id`, `ordem_servico_id`, `descricao`, `quantidade`, `valor_unitario`).

---

## 🌟 Funcionalidades e Requisitos Atendidos

1. **Plug-and-play**: Inicialização com criação automática de tabelas e carga inicial de 2 clientes e 2 OS com itens.
2. **Máscara de Input Nativa**: Campo de CPF com máscara JavaScript pura no padrão `000.000.000-00`, que impede a digitação de letras e caracteres inválidos. Máscara complementar aplicada ao telefone.
3. **Responsividade Garantida**: Todas as tabelas de dados envolvidas obrigatoriamente por `<div class="table-responsive">` (Bootstrap 5).
4. **Feedback Visual e Limpeza**: Toasts do Bootstrap com confirmação de sucesso ao cadastrar clientes ou OS, acionando a limpeza do formulário (`form.reset()`).
5. **Filtro de Status no Controller**: Listagem com suporte a filtro por status (`Recebido`, `Em Análise`, `Aguardando Peça`, `Concluído`) e busca textual.
6. **Cálculo Automático**: Total calculado somando mão de obra + valor de cada item multiplicado pela quantidade, tanto dinamicamente no front-end quanto garantido atomicamente no back-end via transação SQLite.

---

## 📡 Endpoints da API REST

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/os` | Lista ordens de serviço (suporta `?status=...&busca=...`) |
| `GET` | `/api/os/:id` | Detalhes de uma OS específica com seus itens |
| `GET` | `/api/os/resumo` | Métricas consolidadas (KPIs para os cards) |
| `POST` | `/api/os` | Cria uma nova OS com itens e cálculo automático |
| `PATCH` | `/api/os/:id/status` | Atualiza o status e laudo técnico de uma OS |
| `GET` | `/api/clientes` | Lista todos os clientes cadastrados |
| `POST` | `/api/clientes` | Cadastra um novo cliente com validação de CPF |
