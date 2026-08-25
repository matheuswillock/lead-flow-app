import { describe, expect, it } from "bun:test"
import { validatePublicFormDraft } from "./validate-public-form-draft"
import type { PublicFormDraftInput, PublicFormQuestionInput } from "./types"

/**
 * SPEC 40 — E4/DA4. `validatePublicFormDraft` já exigia nome mapeado e
 * obrigatório (regras 3-4), mas não exigia nenhum canal de contato: um
 * formulário estruturalmente incapaz de gerar lead pela regra vigente publicava
 * assim mesmo (auditoria F5 — os casos Avalanche/Evous).
 *
 * A exigência liga por padrão. `leadCaptureDisabled` é a saída explícita para
 * formulário de pesquisa — e desliga junto as métricas de lead daquele form,
 * porque prometer funil de lead onde não há captação é pior que não ter.
 *
 * A regra roda em `mode: "form"`, que é chamado só de `publicationErrors` —
 * form já publicado não é tocado, a exigência vale da próxima publicação em
 * diante.
 */

import {
  CONTACT_QUESTION_ERROR as CONTACT_ERROR,
  SURVEY_WITH_SCHEDULING_ERROR,
} from "./validate-public-form-draft"

function question(overrides: Partial<PublicFormQuestionInput>): PublicFormQuestionInput {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    type: "text",
    title: "Pergunta",
    required: false,
    scoreWeight: 0,
    options: [],
    mappingTarget: null,
    mappingKey: null,
    ...overrides,
  } as PublicFormQuestionInput
}

const NAME_QUESTION = question({
  id: "11111111-1111-4111-8111-111111111101",
  title: "Nome",
  required: true,
  scoreWeight: 100,
  mappingTarget: "native_field",
  mappingKey: "name",
})

const PHONE_QUESTION = question({
  id: "11111111-1111-4111-8111-111111111102",
  type: "phone",
  title: "WhatsApp",
  required: true,
  mappingTarget: "native_field",
  mappingKey: "phone",
})

const EMAIL_QUESTION = question({
  id: "11111111-1111-4111-8111-111111111103",
  type: "email",
  title: "E-mail",
  mappingTarget: "native_field",
  mappingKey: "email",
})

function draft(overrides: Partial<PublicFormDraftInput> = {}): PublicFormDraftInput {
  return {
    name: "Formulário",
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Obrigado",
    successActions: [],
    thankYouPages: [
      { id: "22222222-2222-4222-8222-222222222222", isDefault: true, actions: [] },
    ] as unknown as PublicFormDraftInput["thankYouPages"],
    defaultThankYouPageId: "22222222-2222-4222-8222-222222222222",
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    questions: [NAME_QUESTION],
    rules: [],
    scoreBands: [],
    ...overrides,
  }
}

describe("validatePublicFormDraft — pergunta de contato (DA4)", () => {
  // T-F4.1
  it("recusa publicação de form de captação sem telefone nem e-mail", () => {
    const errors = validatePublicFormDraft(draft(), { mode: "form" })

    expect(errors).toContain(CONTACT_ERROR)
  })

  it("aceita quando há telefone mapeado", () => {
    const errors = validatePublicFormDraft(
      draft({ questions: [NAME_QUESTION, PHONE_QUESTION] }),
      { mode: "form" },
    )

    expect(errors).not.toContain(CONTACT_ERROR)
  })

  it("aceita quando há e-mail mapeado", () => {
    const errors = validatePublicFormDraft(
      draft({ questions: [NAME_QUESTION, EMAIL_QUESTION] }),
      { mode: "form" },
    )

    expect(errors).not.toContain(CONTACT_ERROR)
  })

  // T-F4.2
  it("leadCaptureDisabled publica sem contato — é form de pesquisa", () => {
    const errors = validatePublicFormDraft(draft({ leadCaptureDisabled: true }), { mode: "form" })

    expect(errors).not.toContain(CONTACT_ERROR)
  })

  it("pergunta de contato só conta quando está mapeada ao campo nativo", () => {
    const soltoNoHistorico = question({
      id: "11111111-1111-4111-8111-111111111104",
      type: "phone",
      title: "Telefone do contador",
      mappingTarget: "notes",
      mappingKey: null,
    })

    const errors = validatePublicFormDraft(
      draft({ questions: [NAME_QUESTION, soltoNoHistorico] }),
      { mode: "form" },
    )

    expect(errors).toContain(CONTACT_ERROR)
  })

  it("template do catálogo não é bloqueado pela regra de captação", () => {
    const errors = validatePublicFormDraft(draft(), { mode: "catalog-template" })

    expect(errors).not.toContain(CONTACT_ERROR)
  })
})

/**
 * Review do #1048 (P1). O agendamento nasce preso ao lead: `processInBackground`
 * só chama `scheduleMeeting` quando há lead resolvido. Com a captação desligada
 * nunca há — então o visitante escolheria o horário, veria a tela de
 * agradecimento, e nenhuma reunião existiria. Promessa quebrada com uma pessoa
 * real, em silêncio.
 */
describe("validatePublicFormDraft — pesquisa × agenda", () => {
  const SCHEDULING_QUESTION = question({
    id: "11111111-1111-4111-8111-111111111105",
    type: "scheduling",
    title: "Escolha o horário",
  })
  const CLOSER_ID = "33333333-3333-4333-8333-333333333333"

  it("recusa formulário de pesquisa com agenda ligada", () => {
    const errors = validatePublicFormDraft(
      draft({
        leadCaptureDisabled: true,
        schedulingEnabled: true,
        eligibleCloserIds: [CLOSER_ID],
        questions: [NAME_QUESTION, SCHEDULING_QUESTION],
      }),
      { mode: "form" },
    )

    expect(errors).toContain(SURVEY_WITH_SCHEDULING_ERROR)
  })

  it("agenda com captação ligada continua permitida", () => {
    const errors = validatePublicFormDraft(
      draft({
        schedulingEnabled: true,
        eligibleCloserIds: [CLOSER_ID],
        questions: [NAME_QUESTION, PHONE_QUESTION, SCHEDULING_QUESTION],
      }),
      { mode: "form" },
    )

    expect(errors).not.toContain(SURVEY_WITH_SCHEDULING_ERROR)
  })

  it("pesquisa sem agenda continua publicando", () => {
    const errors = validatePublicFormDraft(draft({ leadCaptureDisabled: true }), { mode: "form" })

    expect(errors).not.toContain(SURVEY_WITH_SCHEDULING_ERROR)
  })
})
