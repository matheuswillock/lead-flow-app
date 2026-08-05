# Spec: Bridge Formulário → Temperatura de Lead (D19-B-bis)

**Versão:** 1.0  
**Data:** 2026-08-04  
**Status:** Proposta — depende de D19-A (BackofficeRadarEngagementWeight) e D19-B (score inline)  
**Relacionado:** `specs/radar-d19-engagement-score.md`

---

## Problema

O motor de engajamento D19 trata `form.completed` como um evento binário (+25 pontos fixos). Mas o Corretor Studio já sabe muito mais: cada formulário calcula um **score de qualidade 0–100** com base nas respostas do lead, configurado questão a questão pelo time.

Um lead que preencheu o formulário com as respostas ideais (plano top, orçamento alto, quer comprar agora) e um lead que respondeu tudo "sem interesse" contribuem igualmente para a temperatura — ambos recebem +25. Isso desperdiça informação que já existe.

O objetivo desta spec é fechar a lacuna: o score de qualidade do formulário deve escalar a contribuição do `form.completed` para a temperatura do lead, usando uma tabela de mapeamento configurável exclusivamente pelo backoffice.

---

## Auditoria do estado atual

### Sistema de score dos formulários (já existe, por time)

```
PublicFormQuestion.scoreWeight  Int   -- peso desta pergunta (0–100; soma de todas = 100)
PublicFormOption.score          Int   -- pontuação desta opção (0–100)
PublicFormOption.scorePolarity  String -- "positive" | "negative"
```

`calculatePublicFormScorePercent(form, answers)` — função pura em `lib/public-forms/engine.ts`:
```ts
const raw = calculatePublicFormScore(form, answers)         // soma de (peso × scoreOpcao × polaridade)
const max = calculatePublicFormMaxPossibleScore(form)        // soma dos melhores resultados possíveis
return Math.min(100, Math.round((100 * raw) / max))         // percentil 0–100
```

O resultado é armazenado em `PublicFormSubmission.score` e `PublicFormSubmission.scoreBandLabel`.

### O que está faltando

`SyncPublicFormMetricToRadarUseCase` recebe o `eventKey` da `PublicFormMetricEvent` mas **não** recebe o score da submissão. O metadata do `RadarEvent` de `form.completed` contém apenas `{ formId, publicationId, leadId?, origin? }`.

No engagement engine D19, `form.completed` usa o peso base fixo definido em `BackofficeRadarEngagementWeight`. Não há como saber se a resposta foi de alta ou baixa qualidade.

---

## Arquitetura proposta — a "conversa"

```
[Time configura]                         [Backoffice configura]
  questão.scoreWeight                       BackofficeFormEngagementScoreRule
  opção.score / polarity                    (minPercent, maxPercent, multiplier)
        ↓                                           ↓
  calculatePublicFormScorePercent()          engagement engine lê metadata.formScorePercent
        ↓                                           ↓
  submission.score (0–100)        →    form.completed weight × multiplier
        ↓                                           ↓
  armazenado em RadarEvent.metadata      contribuição para engagementScore do perfil
```

O time controla o que qualifica um lead de acordo com o negócio deles.
O backoffice controla como diferentes faixas de qualidade se traduzem em temperatura.
Os dois sistemas nunca se misturam — o score do formulário é um intermediário.

---

## Nova tabela de banco de dados (backoffice)

```prisma
model BackofficeFormEngagementScoreRule {
  id           String   @id @default(uuid()) @db.Uuid
  minPercent   Int      -- 0..100 — limite inferior da faixa de score (inclusivo)
  maxPercent   Int      -- 0..100 — limite superior da faixa de score (inclusivo)
  multiplier   Float    -- fator aplicado ao peso base de form.completed
  label        String   @db.Text  -- nome descritivo para o admin do backoffice
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)

  @@unique([minPercent, maxPercent])
  @@map("backoffice_form_engagement_score_rules")
}
```

### Seed de valores padrão

| Faixa de score do form | Multiplicador | Label |
|---|---|---|
| 80–100% | ×2,5 | Lead qualificado — alta intenção |
| 60–79% | ×1,8 | Lead acima da média |
| 40–59% | ×1,0 | Lead médio (peso base sem alteração) |
| 20–39% | ×0,5 | Lead abaixo da média |
| 0–19% | ×0,2 | Lead de baixa qualidade |

**Exemplo prático com peso base de +25 para `form.completed`:**

| Score do formulário | Multiplicador | Temperatura gerada | Banda provável |
|---|---|---|---|
| 90% (respondeu "quer comprar logo, orçamento R$800/mês") | ×2,5 | **62 pts** | 🔥 Quente |
| 70% (respondeu bem, mas orçamento menor) | ×1,8 | **45 pts** | ♨️ Morno |
| 50% (respostas neutras) | ×1,0 | **25 pts** | ♨️ Morno |
| 30% (respondeu com pouco interesse) | ×0,5 | **12 pts** | 🌡️ Morno-frio |
| 10% (respostas incompatíveis com o perfil) | ×0,2 | **5 pts** | 🧊 Frio |

> *Esses valores assumem decaimento ×1,0 (janela de 8–30 dias). Dentro dos últimos 7 dias o multiplicador de recência dobra tudo.*

---

## Alterações no código existente

### 1. `PublicFormMetricEvent` — incluir score no payload do evento

O modelo já tem `questionId` como FK opcional. Adicionamos `submissionScorePercent` ao evento de `form_completed`.

**Opção A (preferida, sem migration):** passar o score via `origin` JSON já existente no evento de métrica:
```ts
// PublicFormSubmissionUseCase.ts — ao enfileirar o job de form_completed
origin: {
  ...existingOrigin,
  submissionScorePercent: score,        // 0–100
  scoreBandLabel: scoreBandLabel,       // ex: "Alta qualidade"
}
```
`PublicFormMetricEvent.origin Json?` já existe e não tem schema fixo — é o lugar certo para dados contextuais do evento.

**Opção B (com migration):** adicionar `submissionScorePercent Int?` ao modelo `PublicFormMetricEvent`. Mais limpo para queries, mais trabalho de schema. Não adotar nesta iteração.

### 2. `SyncPublicFormMetricToRadarUseCase` — propagar para o RadarEvent metadata

O UseCase já recebe `input.origin` e o joga no metadata do `RadarEvent`. A mudança necessária é apenas garantir que `input.origin.submissionScorePercent` chegue na chamada — o plumbing já existe:

```ts
// metadata do RadarEvent (já construído assim no UseCase)
const metadata = {
  formId: input.formId,
  publicationId: input.publicationId,
  ...(input.origin ? { origin: input.origin } : {}),
  // formScorePercent já vem via origin.submissionScorePercent
}
```

Ao invocar o UseCase a partir de `PublicFormsService` (ou `PublicFormSubmissionUseCase`), garantir que o `origin` inclui `submissionScorePercent` quando o eventType é `form_completed`.

### 3. `lib/radar/engagement-score.ts` — ler o multiplier de form score

Na função `computeEngagementScore`, adicionar um case especial para `form.completed`:

```ts
// Para form.completed, o peso base é escalado pelo score de qualidade da submissão
function resolveEventWeight(
  event: RadarEvent,
  weights: WeightMap,
  formRules: FormEngagementScoreRule[],
): number {
  const baseWeight = weights[event.eventType] ?? 0
  if (baseWeight === 0) return 0

  if (event.eventType === "form.completed") {
    const scorePercent = extractFormScorePercent(event.metadata)
    if (scorePercent !== null) {
      const rule = formRules.find(r =>
        scorePercent >= r.minPercent && scorePercent <= r.maxPercent && r.isActive
      )
      const multiplier = rule?.multiplier ?? 1.0
      return Math.round(baseWeight * multiplier)
    }
  }

  return baseWeight
}

function extractFormScorePercent(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as Record<string, unknown>
  // Lê de metadata.origin.submissionScorePercent (Opção A)
  const origin = m.origin
  if (origin && typeof origin === "object") {
    const o = origin as Record<string, unknown>
    const v = o.submissionScorePercent
    if (typeof v === "number" && v >= 0 && v <= 100) return v
  }
  return null
}
```

`formRules` é carregado junto com `weights` no cache de 5 minutos (mesmo pattern), via novo método `BackofficeRadarRepository.getFormEngagementScoreRules()`.

### 4. Backoffice — CRUD de regras

Mesmo padrão de `BackofficeRadarEngagementWeight`:
- `BackofficeFormEngagementScoreRuleUseCase` — `getAll`, `upsert`, `delete`
- Rota `GET/POST/DELETE /api/v1/backoffice/radar/form-engagement-rules`
- Frontend backoffice: tabela de regras editáveis (faixa + multiplicador + label)

**Restrição de negócio (validada no UseCase):**
- As faixas não podem se sobrepor (`minPercent`..`maxPercent` devem ser disjuntos)
- O backoffice deve ter pelo menos uma regra cobrindo 0–100 (senão, score fora de regra usa multiplier 1,0 como fallback)

---

## O que NÃO muda

- O sistema de score por pergunta/opção do formulário (`PublicFormQuestion.scoreWeight`, `PublicFormOption.score`) é uma configuração **por time, por formulário** — não muda nem é substituído. O time continua definindo seus critérios de qualificação normalmente.
- `PublicFormScoreBand` (labels de qualidade da submissão como "Alta qualidade") continua sendo exibido para o time na tela de submissões — não é alterado.
- O `RadarEvent` de `form.completed` continua sendo único por submissão (dedupe por `eventKey`). A mudança é só no metadata e no cálculo posterior de score.
- `form.question_answered` não recebe peso individual — o score holístico da submissão já captura a qualidade de todas as respostas. Pesar eventos individuais de resposta geraria ruído (10 perguntas = 10 eventos × peso = duplicação de sinal).

---

## Sequência de implementação

```
D19-A (tabela BackofficeRadarEngagementWeight já existe)
  ↓
D19-B-bis-A: migration BackofficeFormEngagementScoreRule + seed
  ↓
D19-B-bis-B: propagar submissionScorePercent no origin do MetricEvent (PublicFormSubmissionUseCase)
  ↓
D19-B-bis-C: engagement-score.ts usa o multiplier (resolveEventWeight)
  ↓
D19-B-bis-D: CRUD backoffice + UI
```

B-bis-B e B-bis-C são independentes entre si (podem ir em commits separados).

---

## Testes necessários

| Caso | Assert |
|---|---|
| `form.completed` com `origin.submissionScorePercent: 90` | score = base × 2,5 |
| `form.completed` com `origin.submissionScorePercent: 50` | score = base × 1,0 |
| `form.completed` sem `submissionScorePercent` no metadata | score = base × 1,0 (fallback) |
| `form.completed` com score fora de todas as regras ativas | score = base × 1,0 (fallback) |
| Faixas sobrepostas rejeitadas no UseCase de CRUD | erro de validação |
| `computeEngagementScore` com dois `form.completed` de qualidades diferentes | scores distintos |

---

## Impacto operacional esperado

**Antes:** um lead que preencheu um formulário de requalificação com qualidade 10% e um lead com 90% têm exatamente o mesmo peso de temperatura (+25). O SDR trata os dois igualmente no funil.

**Depois:** o lead de alta qualidade pode chegar à banda "Quente" apenas pelo formulário; o de baixa qualidade mal sai de "Frio". A temperatura passa a refletir qualificação de vendas, não só comportamento.

**Refinamento iterativo:** o backoffice pode ajustar os multiplicadores (ex.: elevar a exigência — só score >85% ganha ×2,5) sem nenhuma mudança de código — só salvar a tabela e rodar o backfill de scores.

---

## Critérios de aceitação

- Submissão com score 90% de um formulário com ScoreBand "Alta qualidade" gera temperatura mais alta que score 20%, no mesmo perfil, com o mesmo base weight.
- Alterar o multiplicador no backoffice e rodar o backfill recalcula todos os `form.completed` existentes com o novo fator.
- Formulários sem configuração de score (todos os `scoreWeight = 0` ou `maxPossibleScore = 0`) tratam `submissionScorePercent` como `null` e usam fallback ×1,0 — sem divisão por zero, sem erro.
- `governance:check` verde; sem allowlist novo; sem dependência nova.
