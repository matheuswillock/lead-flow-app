import type { PublicFormDraftInput } from "../types"
import { redistributeQuestionScoresEvenly } from "../scoring"
import { createDefaultThankYouPage } from "../thank-you-pages"

const FALLBACK_HEALTH_PLANS = [
  "Alice",
  "Amil",
  "Bradesco",
  "Hapvida",
  "Porto Seguro",
  "SulAmérica",
  "Unimed",
  "Outros",
]

/**
 * Seed source for the global `health_plan_simulator` template.
 * Runtime loads the snapshot from `PublicFormTemplate` in the database.
 */
export function createHealthPlanSimulatorDraft(
  planNames: string[] = FALLBACK_HEALTH_PLANS,
): PublicFormDraftInput {
  const page = {
    cover: crypto.randomUUID(),
    operadora: crypto.randomUUID(),
    valor: crypto.randomUUID(),
    idades: crypto.randomUUID(),
    estrutura: crypto.randomUUID(),
    hospitais: crypto.randomUUID(),
    tempo: crypto.randomUUID(),
    captacao: crypto.randomUUID(),
    resultado: crypto.randomUUID(),
    agenda: crypto.randomUUID(),
  }

  const choice = (labels: string[]) =>
    labels.map((label, index) => ({
      id: crypto.randomUUID(),
      label,
      value: label,
      score: index === 0 ? 100 : 50,
      scorePolarity: "positive" as const,
    }))

  const healthPlanLabels =
    planNames.length > 0
      ? [...planNames].sort((a, b) => a.localeCompare(b, "pt-BR"))
      : FALLBACK_HEALTH_PLANS

  const questions = [
    {
      id: crypto.randomUUID(),
      type: "health_plan" as const,
      title: "Qual é a sua operadora atual?",
      description: "Selecione a operadora do plano que você tem hoje.",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "currentHealthPlan",
      config: { pageKey: page.operadora },
      options: choice(healthPlanLabels),
    },
    {
      id: crypto.randomUUID(),
      type: "currency" as const,
      title: "Qual é o valor atual do plano?",
      description: "Informe o valor total da mensalidade que você paga hoje.",
      placeholder: "0,00",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "currentValue",
      config: { pageKey: page.valor },
      options: [],
    },
    {
      id: crypto.randomUUID(),
      type: "text" as const,
      title: "Quais são as idades dos beneficiários?",
      description: "Separe as idades por vírgula. Ex: 42, 38, 10",
      placeholder: "42, 38, 10",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "age",
      config: { pageKey: page.idades },
      options: [],
    },
    {
      id: crypto.randomUUID(),
      type: "single_choice" as const,
      title: "Coparticipação",
      required: true,
      scoreWeight: 0,
      mappingTarget: "history" as const,
      config: { pageKey: page.estrutura },
      options: choice(["Com coparticipação", "Sem coparticipação"]),
    },
    {
      id: crypto.randomUUID(),
      type: "single_choice" as const,
      title: "Acomodação",
      required: true,
      scoreWeight: 0,
      mappingTarget: "history" as const,
      config: { pageKey: page.estrutura },
      options: choice(["Enfermaria", "Apartamento"]),
    },
    {
      id: crypto.randomUUID(),
      type: "single_choice" as const,
      title: "Contratação",
      required: true,
      scoreWeight: 0,
      mappingTarget: "history" as const,
      config: { pageKey: page.estrutura },
      options: choice(["CNPJ (Empresarial)", "Pessoa Física"]),
    },
    {
      id: crypto.randomUUID(),
      type: "multiple_choice" as const,
      title: "Qual hospital você não abre mão?",
      description: "Selecione até 2 hospitais de referência.",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "referenceHospital",
      config: { pageKey: page.hospitais, maxSelections: 2 },
      options: choice([
        "Albert Einstein",
        "Nove de Julho",
        "Oswaldo Cruz",
        "Samaritano",
        "São Camilo",
        "São Luiz",
        "Sírio Libanês",
        "Outros",
      ]),
    },
    {
      id: crypto.randomUUID(),
      type: "single_choice" as const,
      title: "Há quanto tempo você está nesse plano?",
      description: "Isso impacta diretamente no cálculo de reajuste acumulado.",
      required: true,
      scoreWeight: 0,
      mappingTarget: "history" as const,
      config: { pageKey: page.tempo },
      options: choice(["Menos de 1 ano", "1 a 2 anos", "2 a 4 anos", "Mais de 4 anos"]),
    },
    {
      id: crypto.randomUUID(),
      type: "text" as const,
      title: "Nome completo",
      placeholder: "Seu nome",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "name",
      config: { pageKey: page.captacao },
      options: [],
    },
    {
      id: crypto.randomUUID(),
      type: "phone" as const,
      title: "WhatsApp",
      placeholder: "(11) 99999-9999",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "phone",
      config: { pageKey: page.captacao },
      options: [],
    },
    {
      id: crypto.randomUUID(),
      type: "email" as const,
      title: "E-mail",
      placeholder: "seuemail@exemplo.com",
      required: true,
      scoreWeight: 0,
      mappingTarget: "native_field" as const,
      mappingKey: "email",
      config: { pageKey: page.captacao },
      options: [],
    },
    {
      id: crypto.randomUUID(),
      type: "calculation" as const,
      title: "Resultado da simulação",
      description: "Estimativa de economia com base nas suas respostas.",
      required: false,
      scoreWeight: 0,
      mappingTarget: "history" as const,
      config: { pageKey: page.resultado, engine: "health_plan_reduction" },
      options: [],
    },
    {
      id: crypto.randomUUID(),
      type: "scheduling" as const,
      title: "Escolha o melhor horário",
      description: "Selecione um horário disponível. Você vai receber o convite no e-mail.",
      required: true,
      scoreWeight: 0,
      mappingTarget: "history" as const,
      config: { pageKey: page.agenda },
      options: [],
    },
  ]

  const simulationThankYouPage = createDefaultThankYouPage({
    name: "Resultado da simulação",
    title: "Simulação de {firstName} está pronta",
    description:
      "Veja abaixo a estimativa de economia com base nas suas respostas. Os valores podem variar.",
    kind: "simulation",
    isDefault: false,
    actions: [
      {
        id: crypto.randomUUID(),
        label: "Agendar reunião gratuita",
        type: "close",
      },
    ],
  })
  const defaultThankYouPage = createDefaultThankYouPage({
    name: "Confirmação",
    title: "Reunião agendada!",
    description:
      "Você vai receber um convite no seu e-mail com o link da reunião e todos os detalhes.",
    isDefault: true,
  })

  return {
    name: "Simulador de Redução",
    description: "Simule a redução do seu plano de saúde em menos de 2 minutos.",
    assignedSdrId: null,
    eligibleCloserIds: [],
    coverTitle: "Simule a redução do seu plano de saúde em menos de 2 minutos.",
    coverDescription:
      "Descubra o quanto você pode economizar sem abrir mão da cobertura que você precisa. Análise personalizada e sem compromisso.",
    coverBadge: "Simulador gratuito",
    coverHighlights: [
      { id: crypto.randomUUID(), value: "até 40%", label: "de economia possível" },
      { id: crypto.randomUUID(), value: "2 min", label: "para simular" },
      { id: crypto.randomUUID(), value: "100%", label: "gratuito" },
    ],
    ctaLabel: "Começar",
    successTitle: defaultThankYouPage.title,
    successDescription: defaultThankYouPage.description,
    successActions: defaultThankYouPage.actions,
    thankYouPages: [simulationThankYouPage, defaultThankYouPage],
    defaultThankYouPageId: defaultThankYouPage.id,
    useDefaultTheme: true,
    backgroundColor: "#FFF5F0",
    textColor: "#1A1A1A",
    lineColor: "#E8602C",
    accentColor: "#FF6900",
    buttonTextColor: "#FFFFFF",
    inputBackgroundColor: "#FFFFFF",
    schedulingEnabled: true,
    meetingDurationMinutes: 30,
    schedulingMessage: "Reunião de simulação de redução de plano",
    formKind: "health_plan_simulator",
    questions: redistributeQuestionScoresEvenly(questions),
    rules: [],
    scoreBands: [
      {
        id: crypto.randomUUID(),
        label: "Alta intenção",
        minScore: 71,
        maxScore: 100,
        summary: "Lead engajado no simulador com perfil completo.",
      },
      {
        id: crypto.randomUUID(),
        label: "Qualificado",
        minScore: 41,
        maxScore: 70,
        summary: "Lead com dados suficientes para follow-up.",
      },
      {
        id: crypto.randomUUID(),
        label: "Em qualificação",
        minScore: 0,
        maxScore: 40,
        summary: "Lead iniciou a simulação e precisa de nurturing.",
      },
    ],
  }
}

/** Reconcile health_plan question options with the team catalog (new drafts only). */
export function applyHealthPlanCatalogToDraft(
  draft: PublicFormDraftInput,
  planNames: string[],
): PublicFormDraftInput {
  if (planNames.length === 0) return draft
  const labels = [...planNames].sort((a, b) => a.localeCompare(b, "pt-BR"))
  return {
    ...draft,
    questions: draft.questions.map((question) => {
      if (question.type !== "health_plan") return question
      return {
        ...question,
        options: labels.map((label, index) => ({
          id: crypto.randomUUID(),
          label,
          value: label,
          score: index === 0 ? 100 : 50,
          scorePolarity: "positive" as const,
        })),
      }
    }),
  }
}
