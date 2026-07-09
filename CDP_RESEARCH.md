# CDP_RESEARCH.md — Pesquisa externa: Twenty (metadata engine) e Segment (Spec/Sources/Destinations)

**Data:** 2026-07-07
**Escopo:** Fase 2 do briefing de CDP — pesquisa pública sobre (a) como o Twenty implementa campos/objetos dinâmicos por workspace e (b) o modelo de integração do Segment (Twilio Segment), para fundamentar as decisões do `CDP_SPEC.md`.
**Documentos pares:** `CDP_AUDIT.md` (estado atual), `CDP_SPEC.md` (estado-alvo).
**Método:** documentação oficial + análises técnicas públicas do repositório `twentyhq/twenty`. Nenhum código foi executado ou clonado nesta rodada. O que não pôde ser confirmado publicamente está listado na seção 3.

---

## 1. Twenty — metadata engine (objetos/campos customizáveis por workspace)

### 1.1 Arquitetura confirmada

O Twenty **não usa EAV nem JSONB** como mecanismo principal de campos customizados. A abordagem é a mais radical das três hipóteses do briefing: **geração dinâmica de schema real no Postgres, por workspace**:

1. **Multi-tenancy por schema Postgres:** cada workspace ganha um schema próprio (`workspace_{uuid}`). Um "workspace datasource service" mapeia workspace ID → nome de schema e cria/derruba schemas na provisão/remoção de workspaces.
2. **Metadata tables no schema core:** as definições de objetos e campos (o equivalente aos SObjects do Salesforce) vivem em tabelas `objectMetadata` e `fieldMetadata` no schema central (a documentação oficial descreve o trio `DataSource` / `Object` / `Field`). Constraint de unicidade em `(name, objectMetadataId, workspaceId)` garante nome de campo único por objeto por workspace.
3. **DDL em runtime ("workspace migrations"):** quando um admin cria um campo na UI, uma linha entra em `fieldMetadata` e o engine gera e aplica migrations (TypeORM) que alteram as tabelas reais do schema do workspace — ou seja, **colunas físicas de verdade**, com tipos vindos de um enum compartilhado (`UUID`, `TEXT`, `DATE_TIME`, `BOOLEAN`, `NUMERIC`, `ARRAY`, `TS_VECTOR` — pacote `twenty-shared`). Há um flag `WORKSPACE_SCHEMA_DDL_LOCKED` para travar DDL durante upgrades e evitar migrations concorrentes se destruindo.
4. **GraphQL dinâmico:** o schema GraphQL é computado em runtime a partir da metadata cacheada (`packages/twenty-server/src/engine/api/graphql/workspace-schema-builder/`, com um `TypeMapperService` mapeando `FieldMetadataType` → scalar GraphQL). Isso roda a cada troca de contexto de workspace, não no deploy. Resultado: campo criado na UI vira query `findMany` disponível na API em segundos, sem codegen.
5. **ORM próprio:** o Twenty mantém um ORM interno ("twenty-orm") sobre o TypeORM para lidar com entidades cuja forma só é conhecida em runtime.

### 1.2 Trade-offs de cada abordagem (à luz do que o Twenty escolheu)

| Abordagem | Performance de filtro/índice | RLS por tenant | Validação de tipo | Complexidade operacional |
|---|---|---|---|---|
| **Tabelas/colunas reais geradas em runtime (Twenty)** | Excelente — índices e tipos nativos do Postgres por campo | Trivial dentro do schema por workspace (isolamento físico) | Nativa (tipo de coluna) | **Altíssima** — DDL em runtime, locks de migration (`WORKSPACE_SCHEMA_DDL_LOCKED`), ORM próprio, GraphQL dinâmico, cache de schema. Issues públicas confirmam o custo: timeout ao adicionar campo em objeto grande (issue #8457), quebra de schema em upgrade (relatos em Cloudron), cobertura de teste esparsa justamente no pipeline de assembly dinâmico |
| **EAV (tabela de definição + tabela de valor)** | Boa com índices compostos (`definitionId`, valor) e GIN quando o valor é `jsonb`; filtro vira `EXISTS`/join por campo filtrado — degrada se muitos campos forem filtrados ao mesmo tempo, aceitável com cap de definições por tenant | Simples — as duas tabelas carregam `teamId` e recebem policies normais | Feita em aplicação (o tipo vive na definição; o valor é validado contra ela — Zod dinâmico) | **Baixa** — zero DDL em runtime, schema Prisma estático, migrations normais |
| **JSONB no próprio registro (coluna `custom_fields jsonb` no Lead)** | Média — GIN index cobre containment (`@>`), mas ordenação/range por campo exige índices por expressão criados... via DDL por campo (volta o problema); estatísticas de planner fracas em jsonb | Simples (mesma linha do Lead) | Em aplicação; sem integridade referencial das opções de select; histórico/auditoria por campo mais difícil | Baixa no início, dívida crescente conforme surgem exigências de filtro/ordenação |

**Leitura para o Corretor Studio:** a abordagem do Twenty só faz sentido porque o produto deles É o metadata engine — eles aceitaram DDL em runtime, ORM próprio e GraphQL dinâmico como núcleo do negócio. Para um SaaS multi-tenant em **um único banco Supabase compartilhado, com Prisma de schema estático e pipeline de migrations via Supabase CLI (governança do projeto)**, gerar tabelas/colunas por Time em runtime é incompatível com o stack e com a política de migrations. O EAV com valor `Json` — que o projeto **já implementou** em `LeadCustomFieldDefinition`/`LeadCustomFieldValue` (ver `CDP_AUDIT.md` §2.1) — é o ponto médio correto; o que falta é o lado de consulta (filtro/ordenação) com índices adequados, não trocar de modelo.

### 1.3 O que dá para inspecionar no código-fonte

O Twenty é AGPL/open-source e o código da metadata engine é público. Módulos citados por fontes técnicas (não inspecionados linha a linha nesta rodada):

- `packages/twenty-server/src/engine/api/graphql/workspace-schema-builder/` — assembly do schema GraphQL dinâmico (`TypeMapperService`).
- `packages/twenty-server/src/engine/metadata-modules/` — módulos de `objectMetadata`/`fieldMetadata` (localização usual; confirmar no repo).
- `packages/twenty-shared` — enum de tipos de campo.
- Docs oficiais: <https://docs.twenty.com/developers/contribute/capabilities/backend-development/custom-objects> (descreve o trio DataSource/Object/Field e o fluxo `/metadata API` → GraphQL cacheado, mas **não** detalha o mecanismo físico de armazenamento — essa parte veio de análises de terceiros e issues, ver §3).

---

## 2. Segment (Twilio Segment) — Sources, Destinations e a Spec

### 2.1 Conceitos

- **Source:** entidade que **envia** dados PARA o Segment (site, app, servidor, ou um SaaS de terceiros). Autentica com **Write Key** do workspace do cliente, enviada no corpo/auth da requisição à **HTTP Tracking API** (`api.segment.io`). Existe o método `batch` para enviar séries de identify/track/etc. em uma chamada.
- **Destination:** entidade que **recebe** dados DO Segment (ferramentas de e-mail, analytics, warehouses). Para um SaaS receber eventos há três caminhos: (a) entrar no catálogo como Destination Partner via Developer Center (processo de aprovação "Segment Select Partner", exige inclusive suporte a deleção federada de usuários), (b) o cliente configurar o **Webhooks Destination** genérico apontando para um endpoint público do SaaS (resposta em <5s, retries do Segment), (c) Destination Functions (JavaScript custom rodando no Segment do cliente).

### 2.2 A Spec (chamadas fundamentais)

| Chamada | Semântica | Payload essencial |
|---|---|---|
| `identify` | Quem é o usuário — cria/atualiza o perfil com **traits** (nome, email, telefone, plano, campos custom) | `userId` (e/ou `anonymousId`) + `traits` |
| `track` | O que o usuário fez — evento nomeado, append-only | `userId` + `event` (nome legível) + `properties` |
| `group` | A que conta/organização o usuário pertence | `userId` + `groupId` + `traits` do grupo |
| `page`/`screen` | Em que página/tela o usuário está (contexto web/mobile) | `userId` + `name` + `properties` |
| `alias` | Reconciliar duas identidades (merge de userId) | `previousId` + `userId` |

Regras relevantes: toda chamada server-side deve carregar `userId` estável; `identify`/`group`/`alias` são "upsert de registro", `track`/`page`/`screen` são "append de evento". Campos comuns (`timestamp`, `context`, `integrations`) acompanham qualquer chamada.

### 2.3 Source vs Destination para o Corretor Studio — análise

**Atuar como Source é drasticamente mais barato e é o caminho validado pela documentação:**

- Não exige aprovação de parceria: o padrão documentado pelo próprio Segment para SaaS ("Build a Source") é o cliente **colar a Write Key do workspace dele** na UI de integrações do SaaS, e o SaaS postar `identify`/`track` na HTTP Tracking API com o `userId` consistente. É exatamente o modelo Totango/Customer.io etc.
- O Corretor Studio **já possui** os dois insumos: perfil unificado (`CustomerProfile` → `identify` traits) e eventos canônicos com dedupe (`CustomerEvent` → `track`), ver `CDP_AUDIT.md` §2.2–2.3.
- Infra necessária: um adapter HTTP + fila leve de saída (outbox + cron, padrão já existente no projeto) + Write Key cifrada por Time.

**Atuar como Destination exige bem mais:**

- Ou processo de aprovação no catálogo (Developer Center, requisitos de parceiro, deleção federada), ou instruir o cliente a configurar o Webhooks Destination genérico apontando para um endpoint público do Corretor Studio — que então precisa de autenticação por shared secret, resposta <5s, idempotência de retries e um mapeamento de eventos externos → domínio interno (que hoje não existe).
- O valor de negócio de receber eventos de outras ferramentas (ex.: comportamento no site do corretor) só se materializa depois que os perfis/segmentos internos já são confiáveis.

**Conclusão da pesquisa (a validar com o dono do produto, pergunta bloqueante (b) do briefing):** implementar **Source primeiro** — `identify` na criação/atualização de perfil CDP e `track` nos eventos já cobertos por `CustomerEvent`/`ActivityType`. Destination fica como não-goal explícito da v1, com o desenho do adapter deixando a porta aberta (interface direcional).

### 2.4 Autenticação e escopo da Write Key

A Write Key identifica **uma Source em um workspace do cliente**. Como cada Time do Corretor Studio é um tenant independente (e o precedente de créditos de e-mail já fixou configuração **por Time** — `EmailTeamSettings`), a Write Key deve ser configurada **por Time**, cifrada em repouso no padrão já usado por `TeamStudioWebhookConfig` (`tokenCipher`/`tokenHash`/`tokenPreview` + `ENCRYPTION_KEY`), com variável de ambiente apenas para defaults/flags (`SEGMENT_*`), nunca uma chave global compartilhada entre Times.

---

## 3. O que NÃO foi possível confirmar publicamente

1. **Twenty:** o detalhe exato do mecanismo físico (colunas reais por workspace schema + workspace migrations) vem de análise técnica de terceiros (codeline.co) e issues do GitHub — a página oficial de docs sobre custom objects descreve apenas a camada de metadata (`DataSource`/`Object`/`Field`) e o fluxo de API, sem afirmar "colunas reais". A inspeção direta de `packages/twenty-server/src/engine/metadata-modules/**` confirmaria; não foi feita nesta rodada (o repositório é público e permite).
2. **Twenty:** comportamento/limites do modo multi-workspace no mesmo banco em escala (há issues abertas de instabilidade, ex. #16696), e o custo real de `ALTER TABLE` em tabelas grandes (issue #8457 relata timeout) — sem números públicos.
3. **Segment:** custos/limites de rate da HTTP Tracking API por plano do cliente final (a doc pública não fixa limites por write key), e prazos reais do processo "Segment Select Partner" para entrar no catálogo como Source/Destination oficial.
4. **Segment:** se o cliente-alvo do Corretor Studio (corretor de planos de saúde) de fato possui workspace Segment próprio — isso é premissa de negócio, não técnica, e é exatamente a pergunta bloqueante (b) do briefing. A spec assume Source-first condicionada a essa validação.

---

## 4. Fontes

### Twenty
- Repositório: <https://github.com/twentyhq/twenty>
- Docs oficiais (custom objects): <https://docs.twenty.com/developers/contribute/capabilities/backend-development/custom-objects>
- Análise técnica da metadata engine: <https://www.codeline.co/thoughts/repo-review/2024/twenty-open-source-crm>
- Issue de custo de DDL em runtime: <https://github.com/twentyhq/twenty/issues/8457>
- Issue multi-workspace: <https://github.com/twentyhq/twenty/issues/16696>
- DeepWiki (visão estrutural do monorepo): <https://deepwiki.com/twentyhq/twenty>

### Segment
- Introdução (Sources vs Destinations): <https://segment.com/docs/guides/>
- Spec Identify: <https://segment.com/docs/connections/spec/identify/>
- Spec Track: <https://segment.com/docs/connections/spec/track/>
- Spec Group: <https://segment.com/docs/connections/spec/group/>
- HTTP API Source (Write Key, batch): <https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/>
- Build a Source (modelo de parceria): <https://segment.com/docs/partners/sources/>
- Webhooks Destination (caminho inbound genérico): <https://segment.com/docs/connections/destinations/catalog/webhooks/>
- Building a Direct Destination (parceria inbound): <https://segment.com/docs/partners/direct-destination/>
- Destination Functions: <https://segment.com/docs/connections/functions/destination-functions/>
