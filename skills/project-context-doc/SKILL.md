---
name: project-context-doc
description: Analisa um repositório GitHub do Corretor Studio (lead-flow-app), cruza com a documentação interna e o banco de dados Supabase, e gera o arquivo CONTEXTO_DO_PROJETO.md com visão de produto, público-alvo, preços reais, níveis de acesso, funcionalidades e arquitetura. Use quando o usuário pedir para criar, atualizar ou reescrever o contexto do projeto.
---

# Project Context Doc — Corretor Studio

Gera ou atualiza o arquivo `CONTEXTO_DO_PROJETO.md` no repositório do Corretor Studio com base em análise do código, documentação e banco de dados Supabase.

## Processo

1. Clonar o repositório (se ainda não clonado)
2. Coletar fontes primárias de contexto
3. Consultar preços reais no Supabase
4. Redigir e salvar o documento

## Passo 1 — Clonar o repositório

```bash
gh repo clone matheuswillock/lead-flow-app /home/ubuntu/lead-flow-app
```

Se o diretório já existir, pule este passo.

## Passo 2 — Coletar fontes primárias

Ler os arquivos abaixo nesta ordem de prioridade. Parar quando o contexto estiver suficiente.

| Prioridade | Arquivo | O que extrai |
|---|---|---|
| 1 | `README.md` | Stack, arquitetura, scripts |
| 2 | `docs/AI_PROJECT_CONTEXT.md` | Visão de produto, ICP, modelo de negócio |
| 3 | `.github/instructions/project-context.instructions.md` | Stack detalhada, schema, rotas, integrações |
| 4 | `app/[supabaseId]/docs/features/services/docsManualData.ts` | Funcionalidades em linguagem de produto |
| 5 | `components/app-sidebar.tsx` | Módulos reais vs. "em breve", controle de acesso |
| 6 | `app/page.tsx` | Posicionamento comercial e SEO |
| 7 | `agents.md` | Governança e regras para IA |
| 8 | `package.json` | Versões reais das dependências |

Confirmar domínios de API com `ls app/api/v1/` e páginas autenticadas com `ls app/[supabaseId]/`.

## Passo 3 — Consultar preços no Supabase

> **Compatibilidade de ambiente:**
> Os comandos `manus-mcp-cli` abaixo funcionam **exclusivamente no ambiente Manus AI**, onde o utilitário está pré-instalado em `/usr/local/bin/manus-mcp-cli`.
> Em outros agentes (Codex, Claude Code, Cursor), use o servidor MCP Supabase configurado em `.mcp.json` com a ferramenta equivalente do seu ambiente:
> - **Claude Code / Cursor**: chame `mcp__supabase__execute_sql` diretamente via interface MCP nativa.
> - **Codex (OpenAI)**: use a integração MCP configurada no seu workspace com o mesmo endpoint `supabase` de `.mcp.json`.
> O servidor MCP Supabase está configurado em `.mcp.json` com `project_ref=wcnxwdcoambpfwxwubka`.

Identificar o projeto `corretor-studio` via MCP Supabase:

```bash
manus-mcp-cli tool call list_projects --server supabase --input '{}'
# Usar o project_id com name "corretor-studio" e status ACTIVE_HEALTHY
```

Consultar produtos e regras de pagamento:

```bash
manus-mcp-cli tool call execute_sql --server supabase \
  --input '{"project_id": "<id>", "query": "SELECT p.name, p.slug, p.type, p.\\"billingMode\\", p.\\"priceMonthly\\", p.\\"priceQuarterly\\", p.\\"priceSemiannual\\", p.\\"priceLifetime\\", r.\\"paymentMethod\\", r.\\"billingCycle\\", r.price, r.\\"canInstallment\\", r.\\"maxInstallments\\" FROM backoffice_products p LEFT JOIN backoffice_product_payment_rules r ON p.id = r.\\"productId\\" ORDER BY p.\\"priceMonthly\\", r.\\"billingCycle\\";"}'
```

Usar os valores retornados como fonte de verdade para preços. Nunca usar preços hardcoded da documentação.

## Passo 4 — Redigir o documento

Salvar em `/home/ubuntu/lead-flow-app/CONTEXTO_DO_PROJETO.md` seguindo a estrutura abaixo. Escrever em parágrafos completos, não em listas de bullets. Usar tabelas para comparações e níveis de acesso.

Ver template completo em `templates/CONTEXTO_DO_PROJETO.template.md`.

## Regras de conteúdo (canônicas)

**Público-alvo**: Corretoras de saúde que trabalham com a venda de planos de saúde.

**Níveis de acesso** — usar sempre esta definição:

| Nível | Descrição |
|---|---|
| **Master** | Dono da conta. Por padrão é Manager, mas com privilégios máximos (cobrança, criação/remoção de usuários, gestão e transferência de times). |
| **Manager** | Gerencia a corretora, cadastra times, assina o produto e acompanha métricas. |
| **Backoffice** | Cuida de processos gerenciais de retaguarda (criação de propostas, carteira de clientes). |
| **Operator** | Acesso operacional às pipelines e agendamentos. |

**Funções operacionais** — usar sempre esta definição:

| Função | Descrição |
|---|---|
| **SDR** | Prospecção, agenda e gerenciamento de clientes nas etapas iniciais do funil. |
| **Closer** | Realiza agendas com novos leads, negocia propostas e fecha as vendas. |

**Preços**: Sempre buscar do Supabase. Nunca assumir valores fixos. Não mencionar *free trial* — o produto não possui.

**Tom**: Profissional, em português (pt-BR), parágrafos completos, sem excesso de bullets.
