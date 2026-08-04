# Spec: Motor de Engajamento (Temperatura de Lead) — Radar D19

**Versão:** 1.0  
**Data:** 2026-08-04  
**Status:** Proposta — aguardando aprovação antes de implementação

---

## Contexto

O Radar acumula eventos de todos os canais (e-mail, WhatsApp, formulário, pixel, CRM, carteira). Hoje o único sinal de "frescor" num perfil é `RadarProfile.lastSeenAt` — um timestamp que avança a cada sync, mas não informa se a pessoa interagiu de verdade ou só foi atualizada por processamento de sistema.

O painel exibe uma métrica chamada "Engajados", que na prática é o count do segmento `opened_not_clicked` — um proxy razoável, mas binário (sim/não), sem continuidade, sem decaimento temporal e sem diferença de peso entre canais.

O objetivo do D19 é substituir essa classificação binária por um **score de engajamento contínuo (0–100)** que reflita recência, frequência e canal de cada interação, e derivar a partir dele uma **banda de temperatura** (`hot`, `warm`, `lukewarm`, `cold`) exibida no perfil do Radar **e** no diálogo de lead do CRM.

---

## Goals

- Score contínuo 0–100 por perfil, atualizado automaticamente a cada evento novo.
- Banda de temperatura derivada do score, exibida no perfil Radar e no Lead Dialog.
- **Pesos configuráveis exclusivamente pelo backoffice** (não por time, não pelo usuário final).
- Segmentos dinâmicos filtrando por banda de temperatura via nova condição DSL `engagement_band`.
- Zero degradação de performance nas listagens existentes — score armazenado como coluna indexada.

## Non-Goals

- Pesos por time (o backoffice define padrões globais; não há override por time nesta versão).
- Score de e-mail marketing isolado (o motor usa todos os canais de evento do Radar).
- Machine learning ou modelos probabilísticos (o motor é determinístico, baseado em regras).
- Alteração do Score em tempo real para o usuário final (a atualização é inline/assíncrona, não blocante).

---

## Background — Auditoria do estado atual

### O que existe hoje

**`RadarProfile.lastSeenAt`** — único timestamp de frescor. Atualizado a cada sync de qualquer canal. Não indica interação real.

**`RadarEvent`** — eventos brutos com `eventType: String @db.Text`, `occurredAt`, `metadata`. Sem peso, sem relevância, sem decaimento.

**Segmentos de sistema** — 6 regras binárias (`email_marketable`, `email_blocked`, `opened_not_clicked`, `clicked_not_closed`, `portfolio_renewal_due`, `inactive_recent_campaign`). Avaliados por `profileMatchesRadarSegment()` que retorna `boolean`, sem score acumulado.

**`getMetrics().engaged`** — count do segmento `opened_not_clicked`. Não é score de engajamento, é contagem de um bucket específico.

**`countSegments()`** — carrega todos os perfis do time em memória e avalia cada um para cada segmento. O(N perfis × 6 segmentos). Com dezenas de milhares de perfis, é uma query pesada sem cache.

### Gaps identificados

| Gap | Impacto |
|---|---|
| Sem diferença de peso entre `email.clicked` e `email.opened` | Click (intenção) vale o mesmo que open (curiosidade passiva) |
| Sem decaimento temporal | Evento de 6 meses atrás tem o mesmo valor que de ontem |
| WhatsApp `message_received` não entra no proxy de engajamento | Sinal mais forte de resposta ativa ignorado |
| `form.completed` fora da equação | Maior sinal de intenção não computado |
| Impossível ordenar por "mais quente primeiro" | Qualquer ranking exige processar todos os eventos de cada perfil em memória |
| `engaged` no dashboard é enganoso | Conta `opened_not_clicked`, não engajamento geral |

---

## Arquitetura proposta

### 1. Configuração de pesos no backoffice

Nova tabela `BackofficeRadarEngagementWeight` (isolada no módulo backoffice — mesma regra de `BackofficeUser`, `BackofficeClient`, etc.):

```sql
-- uma linha por tipo de evento
BackofficeRadarEngagementWeight {
  id          String  @id @default(uuid())
  eventType   String  @db.Text   -- ex: "form.completed", "email.clicked"
  weight      Int                -- peso base 0–100
  description String? @db.Text  -- descrição para o admin do backoffice
  isActive    Boolean @default(true)
  createdAt   DateTime
  updatedAt   DateTime
  @@unique([eventType])
}
```

Nova tabela `BackofficeRadarEngagementConfig` (uma linha, configuração global):

```sql
BackofficeRadarEngagementConfig {
  id                String  @id @default(uuid())
  -- decaimento: janelas de multiplicador de recência
  windowRecentDays  Int  @default(7)   -- últimos N dias → ×recentMultiplier
  windowMidDays     Int  @default(30)  -- N+1..M dias → ×1.0
  windowOldDays     Int  @default(90)  -- M+1..O dias → ×oldMultiplier; acima → 0
  recentMultiplier  Float @default(2.0)
  oldMultiplier     Float @default(0.2)
  -- bandas (threshold mínimo para cada banda)
  hotThreshold      Int  @default(60)
  warmThreshold     Int  @default(30)
  lukewarmThreshold Int  @default(10)
  -- coldThreshold implícito: qualquer score abaixo de lukewarmThreshold
  isActive          Boolean @default(true)
  createdAt         DateTime
  updatedAt         DateTime
}
```

**Valores padrão de peso por tipo de evento** (seed migration populando `BackofficeRadarEngagementWeight`):

| eventType | Peso base | Raciocínio |
|---|---|---|
| `form.completed` | 25 | Maior sinal de intenção — preencheu formulário |
| `lead.milestone.contract_finalized` | 22 | Marco máximo de negócio fechado |
| `lead.milestone.future_sale` | 18 | Compromisso de compra futura |
| `whatsapp.message_received` | 18 | Respondeu — sinal ativo, não passivo |
| `portfolio.renewed` | 15 | Fidelidade renovada |
| `lead.milestone.new_opportunity` | 12 | Nova oportunidade aberta |
| `email.clicked` | 12 | Clique = intenção de ação |
| `form.started` | 8 | Começou mas não completou |
| `lead.milestone.invoice_payment` | 8 | Marco de cobrança |
| `portfolio.brokerage_transfer` | 7 | Troca de corretagem — vínculo ativo |
| `email.opened` | 5 | Curiosidade, sinal passivo |
| `pixel.pageview` | 3 | Visitou o site |
| `email.delivered` | 1 | Contato de sistema |
| `email.bounced` | −30 | Sinal negativo — penaliza score |
| `email.complained` | −50 | Sinal muito negativo — reclamação de spam |

Qualquer `eventType` não listado na tabela é ignorado no cálculo (peso 0).

### 2. Algoritmo de cálculo

Função pura `computeEngagementScore(events: RadarEvent[], weights: WeightMap, config: EngagementConfig): EngagementResult`:

```typescript
type EngagementResult = { score: number; band: "hot" | "warm" | "lukewarm" | "cold" }

function computeEngagementScore(events, weights, config): EngagementResult {
  const now = new Date()
  let total = 0

  for (const event of events) {
    const weight = weights[event.eventType] ?? 0
    if (weight === 0) continue

    const ageMs = now.getTime() - event.occurredAt.getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)

    let multiplier = 0
    if (ageDays <= config.windowRecentDays)      multiplier = config.recentMultiplier
    else if (ageDays <= config.windowMidDays)    multiplier = 1.0
    else if (ageDays <= config.windowOldDays)    multiplier = config.oldMultiplier
    // acima de windowOldDays → multiplier = 0 (ignora o evento)

    total += weight * multiplier
  }

  const score = Math.min(100, Math.max(0, Math.round(total)))

  let band: "hot" | "warm" | "lukewarm" | "cold"
  if      (score >= config.hotThreshold)      band = "hot"
  else if (score >= config.warmThreshold)     band = "warm"
  else if (score >= config.lukewarmThreshold) band = "lukewarm"
  else                                         band = "cold"

  return { score, band }
}
```

Características:
- **Sem cap por eventType**: o score reflete o volume real de interações (um perfil que clicou 5 vezes em e-mails diferentes acumula mais que quem clicou uma vez — comportamento esperado).
- **Cap global**: `Math.min(100, ...)` garante que o score não ultrapassa 100.
- **Eventos negativos** (`email.bounced`, `email.complained`) reduzem o score — um bounce recente derruba mais (multiplicador de recência × peso negativo).
- **Sem estado**: a função é pura, sem I/O. Testável isoladamente.

### 3. Schema — colunas no perfil

```prisma
model RadarProfile {
  // ... campos existentes ...
  engagementScore Int?    @db.SmallInt
  engagementBand  String? @db.Text  -- "hot" | "warm" | "lukewarm" | "cold"
  // ...
  @@index([teamId, engagementBand])
  @@index([teamId, engagementScore(sort: Desc)])
}
```

Migration: `bun run db:migrate:from-prisma -- radar-d19-engagement-score`

### 4. Atualização do score

**Inline, fire-and-forget** — mesmo padrão já usado para `appendEventIfNew`:

Novo método `RadarRepository.updateEngagementScore(profileId, teamId)`:
1. Busca eventos do perfil dentro de `windowOldDays` dias (usando o índice `[profileId, occurredAt(sort: Desc)]` existente).
2. Busca pesos e config do backoffice (cache em memória por 5 minutos — a config muda raramente).
3. Chama `computeEngagementScore(events, weights, config)`.
4. Executa `prisma.radarProfile.update({ where: { id: profileId }, data: { engagementScore, engagementBand } })`.

Integração em `appendEventIfNew` (`RadarRepository.ts`): após gravar o `RadarEvent`, chama `updateEngagementScore(profileId, teamId)` — já dentro do fluxo fire-and-forget do `after()` do Next.js, sem bloquear a resposta.

**Backfill** — nova rota de cron `POST /api/v1/radar/sync/engagement-backfill` (não exposta na UI, só via Postman/cron), processa em lotes de 500 perfis por team, usando a mesma `updateEngagementScore`.

### 5. Novo kind de condição DSL: `engagement_band`

```typescript
// lib/radar/segment-dsl.ts — aditivo ao discriminated union
const engagementBandConditionSchema = z.object({
  kind: z.literal("engagement_band"),
  bands: z.array(z.enum(["hot", "warm", "lukewarm", "cold"])).min(1),
})
```

Tradução em `RadarSegmentQueryService.translateCondition`:

```typescript
case "engagement_band":
  return { engagementBand: { in: condition.bands } }
  // query de índice puro — sem join, sem in-memory scan
```

Exemplos de segmentos que serão possíveis:

```json
// "Leads quentes com contrato vencendo em 90 dias"
{
  "match": "all",
  "conditions": [
    { "kind": "engagement_band", "bands": ["hot", "warm"] },
    { "kind": "lead_field", "fieldKey": "contractDueDate", "operator": "within_days", "value": 90 }
  ]
}

// "Clientes frios para campanha de reativação"
{
  "match": "all",
  "conditions": [
    { "kind": "engagement_band", "bands": ["cold"] },
    { "kind": "consent", "channel": "email", "status": "granted" }
  ]
}
```

### 6. Exibição no Lead Dialog (CRM)

O Lead Dialog (`app/[supabaseId]/leads/[id]/features/`) ganha uma seção "Temperatura Radar" quando o lead tem um perfil Radar associado (identidade `lead_id`):

- **Badge de temperatura**: ícone + rótulo (`🔥 Quente`, `♨️ Morno`, `🌡️ Morno-frio`, `🧊 Frio`) usando `Badge` do shadcn com cor semântica (via token — nunca cor hardcoded).
- **Score numérico**: exibido ao lado do badge (ex: `72/100`).
- **Tooltip**: ao passar o mouse, exibe os últimos 3 eventos que contribuíram para o score.
- **Link para o perfil Radar**: botão "Ver no Radar" que abre a Sheet do perfil.

A informação é carregada de forma lazy (não bloqueia o carregamento do dialog principal): novo endpoint `GET /api/v1/radar/profiles/by-lead/:leadId/engagement` retorna `{ score, band, topEvents }` ou `{ notFound: true }` se o lead não tiver perfil Radar.

### 7. Exibição no Perfil Radar (Sheet)

Na Sheet de perfil do Radar (`RadarProfileSheet.tsx`):

- **Badge de temperatura** no header da Sheet (ao lado do nome/avatar).
- **Score** exibido no painel de "Resumo" como métrica numerada.
- A band `cold` não exibe ícone de fogo — usa um visual neutro/cinza para não alarmar.

**Legenda das bandas:**

| Banda | Score | Cor semântica | Label PT |
|---|---|---|---|
| `hot` | 60–100 | `destructive` (vermelho/laranja) | Quente |
| `warm` | 30–59 | `warning` (âmbar) | Morno |
| `lukewarm` | 10–29 | `secondary` (neutro) | Morno-frio |
| `cold` | 0–9 | `muted` (cinza) | Frio |

### 8. Exibição na listagem de perfis

A tabela de perfis (`RadarProfilesTable.tsx`) ganha uma coluna "Temp." com o badge de banda. Ordenável via `?sort=engagementScore&order=desc` — query de índice puro na nova coluna.

---

## Tabelas de banco de dados (resumo)

| Tabela | Tipo | Descrição |
|---|---|---|
| `BackofficeRadarEngagementWeight` | Nova (backoffice) | Pesos por eventType, configuráveis pelo backoffice |
| `BackofficeRadarEngagementConfig` | Nova (backoffice) | Config global de decaimento e thresholds de banda |
| `RadarProfile.engagementScore` | Coluna nova | Score 0–100, SmallInt, indexado |
| `RadarProfile.engagementBand` | Coluna nova | "hot" | "warm" | "lukewarm" | "cold", indexado |

---

## Estágios de implementação

### D19-A — Configuração de pesos no backoffice

**Escopo:** schema + CRUD no backoffice + seed de pesos padrão.

**O que fazer:**
1. Migrations (via `bun run db:migrate:from-prisma -- radar-d19-engagement-weights`): `BackofficeRadarEngagementWeight` + `BackofficeRadarEngagementConfig`.
2. Seed migration com os 15 pesos padrão da tabela acima + config global com os defaults.
3. `prisma/seed-backoffice-products.ts`: sem `featureSlug` novo aqui — a configuração de pesos é interna do backoffice, não uma feature de time.
4. CRUD backoffice: `BackofficeRadarEngagementWeightUseCase` + rota `GET/POST /api/v1/backoffice/radar/engagement-weights`; `BackofficeRadarEngagementConfigUseCase` + rota `GET/PATCH /api/v1/backoffice/radar/engagement-config`.
5. Frontend backoffice: página de configuração simples (tabela de pesos editável inline + form de config global). Sem novo `featureSlug` — acesso via `getBackofficeAccess()` direto.

**Não tocar:** `RadarProfile`; `segment-dsl.ts`; qualquer UI de time.

**Aceite:** backoffice mostra a tabela de pesos; alterar o peso de `email.clicked` salva; config global atualiza; seed popula os 15 pesos padrão; `governance:check` verde.

---

### D19-B — Score no schema + cálculo inline

**Escopo:** função pura `computeEngagementScore` + colunas no schema + atualização inline.

**O que fazer:**
1. `prisma/schema.prisma`: `RadarProfile.engagementScore Int? @db.SmallInt` + `engagementBand String? @db.Text` + 2 indexes.
2. Migration: `bun run db:migrate:from-prisma -- radar-d19-engagement-score`.
3. `lib/radar/engagement-score.ts` (novo): `computeEngagementScore(events, weights, config)` pura + tipos `WeightMap`, `EngagementConfig`, `EngagementResult`.
4. `RadarRepository.updateEngagementScore(profileId, teamId)`: busca eventos (últimos `windowOldDays` dias), carrega pesos/config com cache de 5 min, chama `computeEngagementScore`, faz `update`.
5. `RadarRepository.appendEventIfNew`: chamar `updateEngagementScore` após gravar o evento (no mesmo bloco fire-and-forget).
6. Testes unitários `lib/radar/engagement-score.test.ts`: 6 casos — score zero (sem eventos), score máximo (cap em 100), decaimento (evento antigo < evento recente), bounce reduz score, banda correta derivada do score, evento não mapeado ignorado.

**Não tocar:** `appendEventIfNew` além de adicionar a chamada; segmento DSL; frontend.

**Aceite:** testes unitários verdes; `prisma.radarProfile.findFirst({ where: { teamId }, select: { engagementScore: true } })` retorna valor numérico após um evento novo; bateria completa verde.

---

### D19-C — DSL `engagement_band` + segmentos por temperatura

**Escopo:** novo kind no DSL + tradutor + backfill + UI do builder.

**O que fazer:**
1. `lib/radar/segment-dsl.ts`: `engagementBandConditionSchema` (kind + bands array).
2. `RadarSegmentQueryService.ts`: case `engagement_band` → `{ engagementBand: { in: bands } }`.
3. Rota de backfill `POST /api/v1/radar/sync/engagement-backfill` (não exposta na UI): processa todos os perfis do time em lotes de 500, chama `updateEngagementScore` para cada um.
4. `RadarSegmentBuilderDialog.tsx`: novo item "Temperatura" em `KIND_OPTIONS`; valor = `Select` multi com as 4 bandas (ícone + label); sem Input de texto livre.
5. Testes: parse do kind novo; tradutor gera `{ engagementBand: { in: [...] } }` correto; perfil com `engagementBand: "hot"` encontrado por segmento `{ bands: ["hot", "warm"] }`; perfil `cold` não retornado.
6. Postman: rota de backfill + rota de segmentos usando a nova condição.

**Não tocar:** system segments existentes (`email_marketable` etc. — não são substituídos); `countSegments()` (o novo kind já é query de índice puro, não precisa de scan).

**Aceite:** criar segmento "Temperatura = Quente" no builder e calcular audiência retorna perfis com `engagementBand: "hot"` (verificável via Postman); backfill processa time completo sem duplicar score; testes e design:check verdes.

---

### D19-D — Lead Dialog + Perfil Radar com temperatura

**Escopo:** badge de temperatura no Lead Dialog do CRM + header da Sheet do Radar.

**O que fazer:**
1. Novo endpoint `GET /api/v1/radar/profiles/by-lead/[leadId]/engagement`: retorna `{ score: number, band: string, topEvents: {...}[] } | { notFound: true }`. UseCase `GetLeadRadarEngagementUseCase`.
2. `RadarTypes.ts`: `LeadRadarEngagement` type com `score`, `band`, `topEvents`.
3. Lead Dialog (`app/[supabaseId]/leads/[id]/features/`): novo hook `useLeadRadarEngagement(leadId)` com dedup (só carrega se a aba estiver visível); seção "Temperatura Radar" com `Badge` + score + tooltip + link "Ver no Radar".
4. `RadarProfileSheet.tsx`: badge de temperatura no header (ao lado do nome); score no painel "Resumo".
5. `RadarProfilesTable.tsx`: coluna "Temp." com badge de banda; `?sort=engagementScore&order=desc` ativado.
6. Tokens de cor (novos, se não existirem em `DESIGN.md`): confirmar com `design:check` que `bg-destructive`/`bg-warning`/`bg-secondary`/`bg-muted` cobrem as 4 bandas sem tokens novos.
7. Testes: endpoint retorna `notFound` quando não há perfil Radar para o lead; retorna score correto quando há; coluna da tabela ordena por score.
8. Postman: endpoint novo.

**Não tocar:** Lead Dialog além da nova seção (não reescrever o dialog inteiro); `RadarProfileSheet.tsx` além do header e seção de resumo.

**Aceite:** abrir um Lead Dialog de um lead com perfil Radar mostra badge + score carregados de forma lazy (não bloqueia o dialog); Sheet do Radar mostra badge no header; tabela de perfis tem coluna de temperatura ordenável; testes e design:check verdes.

---

## Sequência de execução

```
D19-A (backoffice config)
  ↓
D19-B (score inline) — pode rodar em paralelo com D19-A na prática
  ↓
D19-C (DSL + builder + backfill)
  ↓
D19-D (Lead Dialog + Sheet + tabela)
```

D19-A e D19-B são independentes entre si e podem ir em PRs separados. D19-C depende de D19-B (precisa da coluna `engagementBand`). D19-D depende de D19-B (precisa do score no banco).

---

## Critérios de sucesso

- Perfil com 3+ cliques em e-mail nos últimos 7 dias tem `engagementBand: "hot"`.
- Alterar peso de `email.clicked` no backoffice e rodar o backfill atualiza a banda de todos os perfis afetados.
- Segmento "Temperatura = Quente OU Morno" filtra perfis com `engagementBand IN ('hot', 'warm')` via query de índice (verificável via `EXPLAIN ANALYZE`).
- Lead Dialog carrega temperatura em < 200ms (lazy, não bloqueia o dialog principal).
- `countSegments()` existente não é afetado — a nova condição `engagement_band` é uma adição, não substitui os segmentos de sistema.
- Sem nova dependência em `package.json`.
- `governance:check` verde; sem entradas novas no allowlist.

---

## Invariantes preservadas

- Backoffice module isolation: `BackofficeRadarEngagementWeight`/`BackofficeRadarEngagementConfig` usam prefixo `Backoffice*`; rotas sob `/api/v1/backoffice/`; autorizadas via `getBackofficeAccess()`.
- Nenhuma fonte de evento nova dispara e-mail fora do fluxo de campanhas (invariante DA11 do RADAR_SPEC.md).
- `appendEventIfNew` mantém a semântica de dedupe intacta — `updateEngagementScore` é uma operação adicional, não parte da transação de dedupe.
- Pesos não são expostos nem alteráveis por times/usuários finais — apenas o backoffice.
- Score é informativo — nenhuma ação automática (envio de campanha, mudança de status) é disparada com base no score nesta versão.
