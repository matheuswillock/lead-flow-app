/**
 * Snapshot de formulário publicado para specs E2E.
 *
 * É o mesmo formato que `PublicFormsRepository` grava em
 * `PublicFormPublication.snapshot`: o formulário público e as landing pages
 * renderizam e validam a partir dele, não das tabelas. Usado por
 * `landing-pages.ts`. `public-form.spec.ts` ainda monta o próprio snapshot
 * inline (mesmo formato); migrá-lo para cá é um acompanhamento, para não mexer
 * em um spec que já passa.
 *
 * Três perguntas mapeadas para campos nativos de lead: nome, e-mail e telefone.
 */

export type PublicFormFixtureQuestionIds = {
  name: string
  email: string
  phone: string
}

export type PublicFormFixtureInput = {
  formId: string
  publicId: string
  name: string
  coverTitle: string
  questionIds: PublicFormFixtureQuestionIds
}

type FixtureQuestion = {
  id: string
  position: number
  type: "text" | "email" | "phone"
  title: string
  required: boolean
  mappingKey: "name" | "email" | "phone"
}

function questionsFor(ids: PublicFormFixtureQuestionIds): FixtureQuestion[] {
  return [
    { id: ids.name, position: 1, type: "text", title: "Qual o seu nome?", required: true, mappingKey: "name" },
    { id: ids.email, position: 2, type: "email", title: "Qual o seu e-mail?", required: false, mappingKey: "email" },
    { id: ids.phone, position: 3, type: "phone", title: "Qual o seu telefone?", required: true, mappingKey: "phone" },
  ]
}

export function buildPublicFormSnapshot(input: PublicFormFixtureInput) {
  return {
    formId: input.formId,
    publicId: input.publicId,
    version: 1,
    publishedAt: new Date().toISOString(),
    name: input.name,
    coverTitle: input.coverTitle,
    coverDescription: null,
    coverBadge: null,
    coverHighlights: [],
    ctaLabel: "Começar",
    successTitle: "Respostas enviadas",
    successDescription: null,
    successActions: [],
    thankYouPages: [],
    defaultThankYouPageId: null,
    useDefaultTheme: true,
    backgroundColor: null,
    textColor: null,
    lineColor: null,
    accentColor: null,
    buttonTextColor: null,
    inputBackgroundColor: null,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    schedulingMessage: null,
    formKind: "standard",
    eligibleClosers: [],
    theme: {
      backgroundColor: "#ffffff",
      textColor: "#111827",
      lineColor: "#e5e7eb",
      accentColor: "#6366f1",
      buttonTextColor: "#ffffff",
      inputBackgroundColor: "#f9fafb",
    },
    questions: questionsFor(input.questionIds).map((question) => ({
      id: question.id,
      position: question.position,
      type: question.type,
      title: question.title,
      description: null,
      placeholder: null,
      required: question.required,
      scoreWeight: 0,
      options: [],
      mappingTarget: "native_field",
      mappingKey: question.mappingKey,
      url: null,
      config: null,
      whatsappPhone: null,
      whatsappMessage: null,
    })),
    rules: [],
    scoreBands: [],
    assignedSdrId: null,
    eligibleCloserIds: [],
  }
}

export type PublicFormFixtureSnapshot = ReturnType<typeof buildPublicFormSnapshot>
