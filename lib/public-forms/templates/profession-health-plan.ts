import type { PublicFormDraftInput } from "../types"
import { createDefaultThankYouPage } from "../thank-you-pages"

/**
 * Static template mirrored from form publicId aa08d755-0af3-4046-af2a-3bb6a91d8ab4
 * (Kathrein Antunes team). Content is fixed in code — not a shared editable template.
 */
export function createProfessionHealthPlanDraft(): PublicFormDraftInput {
  const page = {
    captacao: crypto.randomUUID(),
    possuiPlano: crypto.randomUUID(),
    operadora: crypto.randomUUID(),
    valor: crypto.randomUUID(),
    idades: crypto.randomUUID(),
    estrutura: crypto.randomUUID(),
    hospitais: crypto.randomUUID(),
  }

  const choice = (labels: string[]) =>
    labels.map((label, index) => ({
      id: crypto.randomUUID(),
      label,
      value: label,
      score: index === 0 ? 100 : 50,
      scorePolarity: "positive" as const,
    }))

  const questionIds = {
    name: crypto.randomUUID(),
    phone: crypto.randomUUID(),
    possuiPlano: crypto.randomUUID(),
    operadora: crypto.randomUUID(),
    valor: crypto.randomUUID(),
    idades: crypto.randomUUID(),
    coparticipacao: crypto.randomUUID(),
    acomodacao: crypto.randomUUID(),
    contratacao: crypto.randomUUID(),
    hospitais: crypto.randomUUID(),
  }

  const healthPlanLabels = [
    "Alice",
    "Amil",
    "Benevida",
    "Bradesco",
    "Hapvida",
    "MedSênior",
    "NotreDame Intermédica (GNDI)",
    "Nova Adesão",
    "Omint",
    "Outros",
    "Plena",
    "Porto Seguro",
    "Prevent Senior",
    "Santa Casa",
    "Sermed",
    "SulAmérica",
    "Unimed",
  ]

  const questions = [
    {
      id: questionIds.name,
      type: "text" as const,
      title: "Nome completo",
      placeholder: "Seu nome",
      required: true,
      scoreWeight: 10,
      mappingTarget: "native_field" as const,
      mappingKey: "name",
      config: { pageKey: page.captacao },
      options: [],
    },
    {
      id: questionIds.phone,
      type: "phone" as const,
      title: "WhatsApp",
      placeholder: "(11) 99999-9999",
      required: true,
      scoreWeight: 10,
      mappingTarget: "native_field" as const,
      mappingKey: "phone",
      config: { pageKey: page.captacao },
      options: [],
    },
    {
      id: questionIds.possuiPlano,
      type: "boolean" as const,
      title: "Já possui plano de saúde?",
      required: true,
      scoreWeight: 10,
      mappingTarget: "history" as const,
      config: { pageKey: page.possuiPlano },
      options: [],
    },
    {
      id: questionIds.operadora,
      type: "health_plan" as const,
      title: "Qual é a sua operadora atual?",
      description: "Selecione a operadora do plano que você tem hoje.",
      required: true,
      scoreWeight: 10,
      mappingTarget: "native_field" as const,
      mappingKey: "currentHealthPlan",
      config: { pageKey: page.operadora },
      options: choice(healthPlanLabels),
    },
    {
      id: questionIds.valor,
      type: "currency" as const,
      title: "Qual é o valor atual do plano?",
      description: "Informe o valor total da mensalidade que você paga hoje.",
      placeholder: "0,00",
      required: false,
      scoreWeight: 10,
      mappingTarget: "native_field" as const,
      mappingKey: "currentValue",
      config: { pageKey: page.valor },
      options: [],
    },
    {
      id: questionIds.idades,
      type: "text" as const,
      title: "Quais são as idades dos beneficiários?",
      description: "Separe as idades por vírgula. Ex: 42, 38, 10",
      placeholder: "42, 38, 10",
      required: true,
      scoreWeight: 10,
      mappingTarget: "native_field" as const,
      mappingKey: "age",
      config: { pageKey: page.idades },
      options: [],
    },
    {
      id: questionIds.coparticipacao,
      type: "single_choice" as const,
      title: "Coparticipação",
      required: true,
      scoreWeight: 10,
      mappingTarget: "history" as const,
      config: { pageKey: page.estrutura },
      options: choice(["Com coparticipação", "Sem coparticipação"]),
    },
    {
      id: questionIds.acomodacao,
      type: "single_choice" as const,
      title: "Acomodação",
      required: true,
      scoreWeight: 10,
      mappingTarget: "history" as const,
      config: { pageKey: page.estrutura },
      options: choice(["Enfermaria", "Apartamento"]),
    },
    {
      id: questionIds.contratacao,
      type: "single_choice" as const,
      title: "Contratação",
      required: true,
      scoreWeight: 10,
      mappingTarget: "history" as const,
      config: { pageKey: page.estrutura },
      options: choice(["CNPJ (Empresarial)", "Pessoa Física"]),
    },
    {
      id: questionIds.hospitais,
      type: "multiple_choice" as const,
      title: "Qual hospital você não abre mão?",
      description: "Selecione até 2 hospitais de referência.",
      required: true,
      scoreWeight: 10,
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
    name: "Página padrão",
    title: "Respostas enviadas",
    description: "Obrigado por responder. Em breve entraremos em contato com você.",
    kind: "standard",
    isDefault: true,
    actions: [
      {
        id: crypto.randomUUID(),
        label: "Falar com um especialista",
        type: "whatsapp",
        whatsappPhone: "5193375996",
        whatsappMessage: "Quero uma análise personalizada do meu plano de saúde",
      },
    ],
  })

  return {
    name: "Formulário básico",
    description: "Captação de Leads",
    assignedSdrId: null,
    eligibleCloserIds: [],
    coverTitle: "Plano de saúde à altura da sua profissão.",
    coverDescription:
      "Agora você pode escolher de verdade, um plano pensado para a sua realidade.",
    coverBadge: "EXCLUSIVO",
    coverHighlights: [
      {
        id: crypto.randomUUID(),
        value: "2 ou + vidas",
        label: "condições de PME mesmo para equipes enxutas.",
      },
      {
        id: crypto.randomUUID(),
        value: "Rede Premium",
        label: "hospitais e clínicas de referência.",
      },
      {
        id: crypto.randomUUID(),
        value: "Especialista Dedicado",
        label: "do desenho do plano à gestão anual.",
      },
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
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    schedulingMessage: "Reunião de simulação de redução de plano",
    formKind: "health_plan_simulator",
    questions,
    rules: [
      {
        id: crypto.randomUUID(),
        sourceQuestionId: questionIds.possuiPlano,
        targetQuestionId: questionIds.idades,
        operator: "equals",
        comparisonValue: "Não",
        action: "skip",
        elseAction: "show",
      },
    ],
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
