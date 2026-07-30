import { describe, expect, it } from "bun:test"
import type { PublicFormDraftInput } from "./types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"
import { createDefaultThankYouPage } from "./thank-you-pages"
import {
  calculatePublicFormMaxPossibleScore,
  calculatePublicFormScore,
  calculatePublicFormScorePercent,
  resolveThankYouPageId,
  resolveVisibleQuestionIds,
  shouldGoToThankYou,
  validateAnswer,
} from "./engine"

const sourceId = "11111111-1111-4111-8111-111111111111"
const targetId = "22222222-2222-4222-8222-222222222222"
const defaultThanks = createDefaultThankYouPage({ id: "33333333-3333-4333-8333-333333333333" })
const branchThanks = createDefaultThankYouPage({
  id: "44444444-4444-4444-8444-444444444444",
  name: "Saída antecipada",
  title: "Obrigado",
  isDefault: false,
})

function form(): PublicFormDraftInput {
  return {
    name: "Qualificação",
    assignedSdrId: null,
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Concluído",
    successActions: [],
    thankYouPages: [defaultThanks],
    defaultThankYouPageId: defaultThanks.id,
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    questions: [
      {
        id: sourceId,
        type: "single_choice",
        title: "Tem interesse?",
        required: true,
        scoreWeight: 60,
        options: [
          { value: "sim", label: "Sim", score: 100, scorePolarity: "positive" },
          { value: "nao", label: "Não", score: 0, scorePolarity: "positive" },
        ],
      },
      {
        id: targetId,
        type: "email",
        title: "E-mail",
        required: true,
        scoreWeight: 40,
        options: [],
      },
    ],
    rules: [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: targetId,
        operator: "equals",
        comparisonValue: "sim",
        action: "show",
        elseAction: "skip",
      },
    ],
    scoreBands: [],
  }
}

describe("motor dos formulários públicos", () => {
  it("resolve perguntas condicionais sem confiar no cliente", () => {
    expect(resolveVisibleQuestionIds(form(), [])).toEqual([sourceId, targetId])
    expect(
      resolveVisibleQuestionIds(form(), [{ questionId: sourceId, value: "sim" }]),
    ).toEqual([sourceId, targetId])
    expect(
      resolveVisibleQuestionIds(form(), [{ questionId: sourceId, value: "nao" }]),
    ).toEqual([sourceId])
  })

  it("calcula pontuação pelo orçamento das perguntas (0–100)", () => {
    expect(calculatePublicFormScore(form(), [{ questionId: sourceId, value: "sim" }])).toBe(60)
    expect(
      calculatePublicFormScore(form(), [
        { questionId: sourceId, value: "sim" },
        { questionId: targetId, value: "a@b.com" },
      ]),
    ).toBe(100)
  })

  it("normaliza pontuação em percentual 0–100", () => {
    expect(
      calculatePublicFormScorePercent(form(), [
        { questionId: sourceId, value: "sim" },
        { questionId: targetId, value: "a@b.com" },
      ]),
    ).toBe(100)
    expect(
      calculatePublicFormScorePercent(form(), [{ questionId: sourceId, value: "nao" }]),
    ).toBe(0)
  })

  it("aplica polaridade negativa nas opções", () => {
    const draft = form()
    draft.questions[0] = {
      ...draft.questions[0],
      options: [
        { value: "sim", label: "Sim", score: 100, scorePolarity: "positive" },
        { value: "nao", label: "Não", score: 50, scorePolarity: "negative" },
      ],
    }
    expect(calculatePublicFormScore(draft, [{ questionId: sourceId, value: "nao" }])).toBe(0)
  })

  it("detecta destino página de agradecimentos", () => {
    const draft = form()
    draft.rules = [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: PUBLIC_FORM_THANK_YOU_TARGET,
        operator: "equals",
        comparisonValue: "nao",
        action: "show",
        elseAction: "skip",
      },
    ]
    expect(shouldGoToThankYou(draft, [{ questionId: sourceId, value: "nao" }])).toBe(true)
    expect(shouldGoToThankYou(draft, [{ questionId: sourceId, value: "sim" }])).toBe(false)
  })

  it("rejeita opções manipuladas e formatos inválidos", () => {
    expect(validateAnswer(form().questions[0], "talvez")).toBe("Selecione uma opção válida")
    expect(validateAnswer(form().questions[1], "invalido")).toBe("Informe um e-mail válido")
    expect(
      validateAnswer(
        { ...form().questions[1], type: "date" },
        "2026-02-31",
      ),
    ).toBe("Informe uma data válida")
  })

  it("exige data e horário no agendamento sem closer", () => {
    const schedulingQuestion = {
      ...form().questions[0],
      type: "scheduling" as const,
      options: [],
    }
    expect(validateAnswer(schedulingQuestion, {})).toBe("Selecione a data e o horário")
    expect(
      validateAnswer(schedulingQuestion, { startsAt: "2026-07-21T12:00:00.000Z" }),
    ).toBeNull()
  })

  it("respeita maxSelections em multiple_choice", () => {
    const question = {
      ...form().questions[0],
      type: "multiple_choice" as const,
      options: [
        { id: "o1", value: "a", label: "A", score: 0, scorePolarity: "positive" as const },
        { id: "o2", value: "b", label: "B", score: 0, scorePolarity: "positive" as const },
        { id: "o3", value: "c", label: "C", score: 0, scorePolarity: "positive" as const },
      ],
      config: { maxSelections: 2 },
    }
    expect(validateAnswer(question, ["a", "b"])).toBeNull()
    expect(validateAnswer(question, ["a", "b", "c"])).toBe("Selecione no máximo 2 opções")
  })

  it("máximo possível soma os scoreWeights das perguntas", () => {
    expect(calculatePublicFormMaxPossibleScore(form())).toBe(100)
  })

  it("múltipla escolha usa peso relativo dentro do scoreWeight da pergunta", () => {
    const question = {
      id: sourceId,
      type: "multiple_choice" as const,
      title: "Hospital de referência",
      required: false,
      scoreWeight: 100,
      options: [
        { value: "a", label: "A", score: 50, scorePolarity: "positive" as const },
        { value: "b", label: "B", score: 50, scorePolarity: "positive" as const },
        { value: "c", label: "C", score: 50, scorePolarity: "positive" as const },
      ],
      config: { maxSelections: 1 },
    }
    const draft: PublicFormDraftInput = { ...form(), questions: [question], rules: [] }

    expect(calculatePublicFormMaxPossibleScore(draft)).toBe(100)
    expect(
      calculatePublicFormScorePercent(draft, [{ questionId: sourceId, value: ["a"] }]),
    ).toBe(100)
  })

  it("mantém scoring legado por opção quando scoreWeight está ausente no snapshot", () => {
    const draft: PublicFormDraftInput = {
      ...form(),
      questions: [
        {
          id: sourceId,
          type: "single_choice",
          title: "Tem interesse?",
          required: true,
          scoreWeight: 0,
          options: [
            { value: "sim", label: "Sim", score: 80, scorePolarity: "positive" },
            { value: "nao", label: "Não", score: 20, scorePolarity: "positive" },
          ],
        },
      ],
      rules: [],
    }
    expect(calculatePublicFormMaxPossibleScore(draft)).toBe(80)
    expect(
      calculatePublicFormScorePercent(draft, [{ questionId: sourceId, value: "sim" }]),
    ).toBe(100)
    expect(
      calculatePublicFormScorePercent(draft, [{ questionId: sourceId, value: "nao" }]),
    ).toBe(25)
  })

  it("remove perguntas posteriores ao sair cedo para agradecimentos", () => {
    const draft = form()
    draft.rules = [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: PUBLIC_FORM_THANK_YOU_TARGET,
        operator: "equals",
        comparisonValue: "nao",
        action: "show",
        elseAction: "skip",
      },
    ]
    expect(resolveVisibleQuestionIds(draft, [{ questionId: sourceId, value: "nao" }])).toEqual([
      sourceId,
    ])
    expect(resolveVisibleQuestionIds(draft, [{ questionId: sourceId, value: "sim" }])).toEqual([
      sourceId,
      targetId,
    ])
  })

  it("ignora regras quando a pergunta-fonte ainda não foi respondida", () => {
    const draft = form()
    draft.rules = [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: targetId,
        operator: "not_equals",
        comparisonValue: "sim",
        action: "skip",
        elseAction: "show",
      },
    ]
    expect(resolveVisibleQuestionIds(draft, [])).toEqual([sourceId, targetId])
    expect(shouldGoToThankYou(draft, [])).toBe(false)
  })

  it("não dispara thank-you antecipado sem resposta na pergunta-fonte", () => {
    const draft = form()
    draft.thankYouPages = [defaultThanks, branchThanks]
    draft.rules = [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: PUBLIC_FORM_THANK_YOU_TARGET,
        targetThankYouPageId: branchThanks.id,
        operator: "equals",
        comparisonValue: "nao",
        action: "show",
        elseAction: "skip",
      },
    ]
    expect(shouldGoToThankYou(draft, [])).toBe(false)
    expect(resolveThankYouPageId(draft, [])).toBe(defaultThanks.id)
  })

  it("resolve página de agradecimentos pela regra de menor sourceIndex", () => {
    const draft = form()
    draft.thankYouPages = [defaultThanks, branchThanks]
    draft.rules = [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: PUBLIC_FORM_THANK_YOU_TARGET,
        targetThankYouPageId: branchThanks.id,
        operator: "equals",
        comparisonValue: "nao",
        action: "show",
        elseAction: "skip",
      },
    ]
    expect(resolveThankYouPageId(draft, [{ questionId: sourceId, value: "nao" }])).toBe(
      branchThanks.id,
    )
    expect(resolveThankYouPageId(draft, [{ questionId: sourceId, value: "sim" }])).toBe(
      defaultThanks.id,
    )
  })
})
