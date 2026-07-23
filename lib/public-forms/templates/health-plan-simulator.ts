import type { PublicFormDraftInput } from "../types"

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

/** Default Onside-style health plan reduction simulator template. */
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
    }))

  const healthPlanLabels =
    planNames.length > 0
      ? [...planNames].sort((a, b) => a.localeCompare(b, "pt-BR"))
      : FALLBACK_HEALTH_PLANS

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
    successTitle: "Reunião agendada!",
    successDescription:
      "Você vai receber um convite no seu e-mail com o link da reunião e todos os detalhes.",
    useDefaultTheme: true,
    backgroundColor: "#FFF5F0",
    textColor: "#1A1A1A",
    lineColor: "#E8602C",
    schedulingEnabled: true,
    meetingDurationMinutes: 30,
    schedulingMessage: "Reunião de simulação de redução de plano",
    formKind: "health_plan_simulator",
    questions: [
      {
        id: crypto.randomUUID(),
        type: "health_plan",
        title: "Qual é a sua operadora atual?",
        description: "Selecione a operadora do plano que você tem hoje.",
        required: true,
        mappingTarget: "native_field",
        mappingKey: "currentHealthPlan",
        config: { pageKey: page.operadora },
        options: choice(healthPlanLabels),
      },
      {
        id: crypto.randomUUID(),
        type: "currency",
        title: "Qual é o valor atual do plano?",
        description: "Informe o valor total da mensalidade que você paga hoje.",
        placeholder: "0,00",
        required: true,
        mappingTarget: "native_field",
        mappingKey: "currentValue",
        config: { pageKey: page.valor },
        options: [],
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        title: "Quais são as idades dos beneficiários?",
        description: "Separe as idades por vírgula. Ex: 42, 38, 10",
        placeholder: "42, 38, 10",
        required: true,
        mappingTarget: "native_field",
        mappingKey: "age",
        config: { pageKey: page.idades },
        options: [],
      },
      {
        id: crypto.randomUUID(),
        type: "single_choice",
        title: "Coparticipação",
        required: true,
        mappingTarget: "history",
        config: { pageKey: page.estrutura },
        options: choice(["Com coparticipação", "Sem coparticipação"]),
      },
      {
        id: crypto.randomUUID(),
        type: "single_choice",
        title: "Acomodação",
        required: true,
        mappingTarget: "history",
        config: { pageKey: page.estrutura },
        options: choice(["Enfermaria", "Apartamento"]),
      },
      {
        id: crypto.randomUUID(),
        type: "single_choice",
        title: "Contratação",
        required: true,
        mappingTarget: "history",
        config: { pageKey: page.estrutura },
        options: choice(["CNPJ (Empresarial)", "Pessoa Física"]),
      },
      {
        id: crypto.randomUUID(),
        type: "multiple_choice",
        title: "Qual hospital você não abre mão?",
        description: "Selecione até 2 hospitais de referência.",
        required: true,
        mappingTarget: "native_field",
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
        type: "single_choice",
        title: "Há quanto tempo você está nesse plano?",
        description: "Isso impacta diretamente no cálculo de reajuste acumulado.",
        required: true,
        mappingTarget: "history",
        config: { pageKey: page.tempo },
        options: choice(["Menos de 1 ano", "1 a 2 anos", "2 a 4 anos", "Mais de 4 anos"]),
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        title: "Nome completo",
        placeholder: "Seu nome",
        required: true,
        mappingTarget: "native_field",
        mappingKey: "name",
        config: { pageKey: page.captacao },
        options: [],
      },
      {
        id: crypto.randomUUID(),
        type: "phone",
        title: "WhatsApp",
        placeholder: "(11) 99999-9999",
        required: true,
        mappingTarget: "native_field",
        mappingKey: "phone",
        config: { pageKey: page.captacao },
        options: [],
      },
      {
        id: crypto.randomUUID(),
        type: "email",
        title: "E-mail",
        placeholder: "seuemail@exemplo.com",
        required: true,
        mappingTarget: "native_field",
        mappingKey: "email",
        config: { pageKey: page.captacao },
        options: [],
      },
      {
        id: crypto.randomUUID(),
        type: "calculation",
        title: "Resultado da simulação",
        description: "Estimativa de economia com base nas suas respostas.",
        required: false,
        mappingTarget: "history",
        config: { pageKey: page.resultado, engine: "health_plan_reduction" },
        options: [],
      },
      {
        id: crypto.randomUUID(),
        type: "scheduling",
        title: "Escolha o melhor horário",
        description: "Selecione um horário disponível. Você vai receber o convite no e-mail.",
        required: true,
        mappingTarget: "history",
        config: { pageKey: page.agenda },
        options: [],
      },
    ],
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
        summary: "Lead com interesse intermediário.",
      },
      {
        id: crypto.randomUUID(),
        label: "Inicial",
        minScore: 0,
        maxScore: 40,
        summary: "Lead captado via simulador.",
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
        })),
      }
    }),
  }
}
