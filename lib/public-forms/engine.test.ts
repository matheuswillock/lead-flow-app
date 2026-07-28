import { describe, expect, it } from "bun:test"
import type { PublicFormDraftInput } from "./types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"
import {
  calculatePublicFormMaxPossibleScore,
  calculatePublicFormScore,
  calculatePublicFormScorePercent,
  resolveVisibleQuestionIds,
  shouldGoToThankYou,
  validateAnswer,
} from "./engine"

const sourceId = "11111111-1111-4111-8111-111111111111"
const targetId = "22222222-2222-4222-8222-222222222222"

function form(): PublicFormDraftInput {
  return {
    name: "Qualificação",
    assignedSdrId: null,
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Concluído",
    successActions: [],
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
    expect(resolveVisibleQuestionIds(form(), [])).toEqual([sourceId])
    expect(
      resolveVisibleQuestionIds(form(), [{ questionId: sourceId, value: "sim" }]),
    ).toEqual([sourceId, targetId])
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
})
