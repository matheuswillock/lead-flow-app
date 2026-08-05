# Spec: Peso por Resposta em Formulários — Temperatura Granular (D19-C)

**Versão:** 1.0  
**Data:** 2026-08-04  
**Status:** Proposta — depende de D19-B-bis (bridge formulário → temperatura) estar ativa  
**Relacionado:** `specs/radar-d19-engagement-score.md`, `specs/radar-d19b-form-score-engagement-bridge.md`

---

## Problema

O sistema já suporta `PublicFormOption.score` (peso 0–100) e `scorePolarity` ("positive"/"negative") por opção, e o builder já tem os controles de slider + seletor de polaridade. Mas **o time de vendas não sabe como usar esses campos** porque:

1. Não há documentação em produto sobre o efeito de cada combinação de peso/polaridade na temperatura do lead.
2. O builder não dá feedback em tempo real: o time configura os pesos sem saber se está produzindo leads Quentes ou Frios.
3. O Lead Dialog não exibe quais respostas específicas de uma submissão mais contribuíram para o score.
4. Não há validação que impeça configurações semanticamente inválidas (ex.: todos os pesos = 0 em todas as opções de uma pergunta com `scoreWeight` alto).

O resultado é que o sistema de pontuação por opção existe mas é invisível — a maioria dos times não configura os pesos porque não entende o impacto.

---

## O que já existe (não mudar)

```
PublicFormQuestion.scoreWeight  Int   -- peso desta pergunta (0–100; soma de todas = 100)
PublicFormOption.score          Int   -- peso relativo desta opção (0–100)
PublicFormOption.scorePolarity  String -- "positive" | "negative"
```

**Lógica de cálculo existente** (`lib/public-forms/engine.ts` + `scoring.ts`):

```ts
// signedOptionScore: aplica polaridade
export function signedOptionScore(option) {
  const magnitude = Math.max(0, option.score)
  return option.scorePolarity === "negative" ? -magnitude : magnitude
}

// Score final da submissão (0–100)
scoreRaw    = Σ (pergunta.scoreWeight × signedOptionScore(opção_escolhida))
scoreMax    = Σ (pergunta.scoreWeight × melhor_opção_possível_positiva)
scorePercent = Math.min(100, Math.round((scoreRaw / scoreMax) × 100))
```

O resultado já é armazenado em `PublicFormSubmission.score` e `scoreBandLabel`.

**Builder UI existente** (`PublicFormWizard.tsx`, para tipos `single_choice` / `multiple_choice` / `health_plan`):
- Slider "Peso relativo" por opção (0–100) — `PublicFormOption.score`
- Select "Polaridade" por opção — `PublicFormOption.scorePolarity`
- `withEqualOptionScores` — redistribui pesos igualmente quando uma opção é adicionada/removida

---

## Arquitetura proposta

### Eixo 1 — Preview de temperatura no builder (feedback em tempo real)

**Objetivo:** o time vê enquanto configura qual temperatura resultaria se o lead escolhesse cada opção.

**Componente:** `FormOptionTemperaturePreview` — exibido dentro do card de cada opção de resposta no builder, logo abaixo do slider de peso. Mostra uma pill colorida com a banda provável ("🔥 Quente", "♨️ Morno", "🧊 Frio") calculada para um cenário hipotético onde TODAS as outras perguntas recebem o peso base (×1,0) e esta opção é a escolhida.

**Cálculo do preview (puro, sem chamada de API):**

```ts
function previewTemperatureForOption(
  form: FormDraft,
  questionId: string,
  optionId: string,
  engagementWeights: EngagementWeightMap,       // pesos do engine carregados uma vez
  formEngagementRules: FormEngagementScoreRule[], // multiplicadores da bridge (D19-B-bis)
): TemperatureBand {
  // 1. Simula submissão hipotética: todas as outras perguntas com opção "neutra" (50% do max)
  // 2. Esta pergunta usa a opção específica
  // 3. Calcula scorePercent com calculatePublicFormScorePercent()
  // 4. Aplica o multiplicador da bridge
  // 5. Aplica o peso base de form.completed
  // 6. Retorna a banda: hot/warm/lukewarm/cold
}
```

Os pesos do engine e as regras da bridge são carregados uma vez (no mount do editor), não a cada interação de slider. O cálculo é síncrono e puro — sem debounce necessário.

**Onde exibir:**

```
┌─────────────────────────────────────────────────┐
│  ○ Acima de R$800/mês                           │
│    Polaridade: [Positivo ▼]  Peso: [100]  ──●   │
│    Temperatura estimada:  🔥 Quente              │
├─────────────────────────────────────────────────┤
│  ○ R$400–R$800/mês                              │
│    Polaridade: [Positivo ▼]  Peso: [65]   ─●    │
│    Temperatura estimada:  ♨️ Morno               │
├─────────────────────────────────────────────────┤
│  ○ Até R$300/mês                                │
│    Polaridade: [Positivo ▼]  Peso: [30]   ●─    │
│    Temperatura estimada:  🌡️ Morno-frio          │
├─────────────────────────────────────────────────┤
│  ○ Sem orçamento definido                       │
│    Polaridade: [Negativo ▼]  Peso: [80]   ──●   │
│    Temperatura estimada:  🧊 Frio                │
└─────────────────────────────────────────────────┘
```

**Quando não exibir:**
- Formulários sem `scoreWeight` configurado em nenhuma pergunta (preview seria sempre "neutro")
- Perguntas de tipo `text`, `date`, `number`, `email`, `phone` (não têm opções)
- Enquanto os pesos do engine/bridge não tiverem carregado (skeleton de uma linha)

---

### Eixo 2 — Lead Dialog: breakdown de score por resposta

**Objetivo:** o SDR que abre o perfil do lead no Lead Dialog vê quais respostas específicas de cada formulário contribuíram para o score — e portanto para a temperatura.

**Endpoint existente (a estender):**
`GET /api/v1/radar/profiles/by-lead/[leadId]/engagement` (D19-D)

Adicionar ao response o campo `formSubmissions`:

```ts
type FormSubmissionScoreBreakdown = {
  submissionId: string
  formId: string
  formTitle: string
  submittedAt: string           // ISO
  scorePercent: number          // 0–100
  scoreBandLabel: string | null // ex: "Alta qualidade"
  answers: {
    questionLabel: string
    chosenOptionLabel: string
    chosenOptionScore: number   // 0–100
    chosenOptionPolarity: "positive" | "negative"
    questionWeight: number      // scoreWeight da pergunta
    contribution: number        // scoreWeight × signedScore (pode ser negativo)
  }[]
  temperatureMultiplier: number // multiplicador aplicado pelo D19-B-bis
  baseWeight: number            // peso base de form.completed no engine (ex: 25)
  finalWeight: number           // baseWeight × temperatureMultiplier
}
```

**Novo UseCase:** `GetFormSubmissionScoreBreakdownUseCase` — dado o `leadId`, busca todas as `PublicFormSubmission` do lead, resolve as respostas, e monta o breakdown. Não recalcula nada — lê `submission.score` já armazenado e busca as opções escolhidas.

**Frontend (Lead Dialog):** nova aba ou seção "Score de formulários" dentro do painel de temperatura, colapsável por formulário. Cada formulário expandido mostra a tabela de respostas com a coluna de contribuição e a temperatura gerada.

---

### Eixo 3 — Validação no builder

**Objetivo:** impedir configurações silenciosamente inválidas.

**Regras de validação** (inline no builder, sem chamada de API):

| Situação | Aviso |
|---|---|
| Pergunta com `scoreWeight > 0` mas todas as opções com `score = 0` | "Esta pergunta não influencia o score — configure um peso para pelo menos uma opção" |
| Pergunta com `scoreWeight > 0` e TODAS as opções com polaridade negativa | "Nenhuma resposta positiva: o lead sempre será penalizado nesta pergunta" |
| Soma dos `scoreWeight` de todas as perguntas ≠ 100 | Já existe indicador visual — manter |
| Formulário com `scoreWeight` somando 100 mas todas as opções com score 0 | Banner no topo: "Score de qualificação não configurado — o formulário não influenciará a temperatura do lead" |

Os avisos são informativos (não bloqueiam salvar) e são exibidos como `Badge variant="destructive"` ou `callout` inline no card da opção/pergunta.

---

### Eixo 4 — Endpoint de pesos do engine para o frontend

**Objetivo:** o builder precisa dos pesos do engine e das regras da bridge para calcular o preview (Eixo 1) sem hardcodar valores.

**Novo endpoint leve:**
`GET /api/v1/forms/engagement-config`

Response:
```ts
{
  formCompletedBaseWeight: number,         // peso base de form.completed no engine
  formEngagementScoreRules: {
    minPercent: number,
    maxPercent: number,
    multiplier: number,
    label: string,
  }[],
}
```

Este endpoint não requer autenticação de time — os valores são globais (configurados pelo backoffice). Cacheável por 5 minutos no cliente (`stale-while-revalidate`).

---

## Alterações no código

### 1. `PublicFormWizard.tsx` — preview de temperatura por opção

```ts
// Novo hook: useFormEngagementConfig()
// - busca GET /api/v1/forms/engagement-config uma vez (stale-while-revalidate)
// - retorna { baseWeight, rules, isLoading }

// Novo utilitário puro: previewTemperatureForOption(form, questionId, optionId, config)
// - importado de lib/public-forms/temperature-preview.ts
// - sem chamada de API, sem side effects

// No render de cada opção de choice question:
{config && !isLoading && (
  <TemperaturePreviewPill
    band={previewTemperatureForOption(form, question.id, option.id, config)}
  />
)}
```

### 2. Novo arquivo `lib/public-forms/temperature-preview.ts`

Função pura exportada:
```ts
export function previewTemperatureForOption(
  form: FormDraft,
  questionId: string,
  optionId: string,
  config: FormEngagementConfig,
): "hot" | "warm" | "lukewarm" | "cold" | null
```

Depende de `calculatePublicFormScorePercent` (já existe) e de `resolveFormEngagementMultiplier` (nova função pura, extraída da lógica da bridge D19-B-bis). Nenhuma dependência de Prisma — 100% testável em unit test.

### 3. `GetFormSubmissionScoreBreakdownUseCase.ts` (novo)

Localização: `app/api/useCases/publicForms/GetFormSubmissionScoreBreakdownUseCase.ts`

Orquestra:
1. `PublicFormSubmissionRepository.findByLeadId(leadId)` — busca submissões
2. Para cada submissão: `PublicFormRepository.findWithAnswers(submissionId)` — resolve opções escolhidas
3. Monta o DTO de breakdown sem recalcular score (usa `submission.score` já gravado)
4. Resolve multiplicador da bridge via `BackofficeFormEngagementScoreRuleRepository.getActive()`

### 4. Rota `GET /api/v1/forms/engagement-config`

Localização: `app/api/v1/forms/engagement-config/route.ts`

- Autenticação: requer sessão válida de time (usa `getTeamAccess()`)
- Response cacheado: `Cache-Control: public, max-age=300, stale-while-revalidate=60`
- Lê de `BackofficeRadarEngagementWeight` (event type `form.completed`) + `BackofficeFormEngagementScoreRule`

### 5. Validações inline no builder (sem novo arquivo)

Adicionadas como derivações puras dentro de `PublicFormWizard.tsx`, calculadas no render a partir do estado atual do formulário. Sem efeito colateral, sem useEffect.

---

## Sequência de implementação

```
D19-C-A: lib/public-forms/temperature-preview.ts (função pura) + testes
    ↓
D19-C-B: GET /api/v1/forms/engagement-config (endpoint)
    ↓
D19-C-C: useFormEngagementConfig hook + TemperaturePreviewPill no builder
    ↓
D19-C-D: GetFormSubmissionScoreBreakdownUseCase + extensão do endpoint de engagement
    ↓
D19-C-E: Lead Dialog — seção de breakdown de score
    ↓
D19-C-F: Validações inline no builder (independente, pode ir em paralelo com C-C)
```

D19-C-A e D19-C-F são independentes entre si e podem ser implementados em paralelo.

---

## O que NÃO muda

- `PublicFormOption.score` e `scorePolarity` — não mudam de schema
- `calculatePublicFormScorePercent()` — não muda a lógica de cálculo
- `withEqualOptionScores()` — não muda (redistribuição ao adicionar/remover opções)
- `rebalanceAfterQuestionWeightEdit()` — não muda
- A forma como o score é armazenado em `PublicFormSubmission.score` — não muda
- O fluxo de sincronização com o Radar (D19-B-bis) — não muda

---

## Testes necessários

| Caso | Assert |
|---|---|
| `previewTemperatureForOption` com opção de score 100 positivo e pergunta com peso 100 | banda "hot" |
| `previewTemperatureForOption` com opção negativa de intensidade alta | banda "cold" |
| `previewTemperatureForOption` sem config carregado | retorna `null` (sem crash) |
| `previewTemperatureForOption` em formulário sem scoreWeight | retorna `null` |
| Builder com pergunta `scoreWeight > 0` e todas opções `score = 0` | aviso visível no render |
| Builder com todas opções negativas | aviso visível no render |
| `GetFormSubmissionScoreBreakdownUseCase` — submissão com 3 respostas | breakdown com `contribution` correto por linha |
| Endpoint `/forms/engagement-config` — retorna `formCompletedBaseWeight` e `formEngagementScoreRules` | 200 com campos esperados |

---

## Critérios de aceitação

- O time configura pesos por opção e vê imediatamente qual temperatura cada opção geraria — sem precisar salvar o formulário e enviar uma submissão de teste.
- O SDR abre o Lead Dialog de um lead que preencheu um formulário e vê quais respostas contribuíram positiva ou negativamente para o score.
- Formulários sem score configurado exibem aviso claro no builder — não aparecem como "configurados" sem efeito.
- `governance:check` verde; sem allowlist novo; sem dependência nova de pacote externo.
- `previewTemperatureForOption` é uma função pura com 100% de cobertura de unit test — sem dependência de I/O.
