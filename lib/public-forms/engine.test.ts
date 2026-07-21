import { describe, expect, it } from "bun:test"
import type { PublicFormDraftInput } from "./types"
import {
  calculatePublicFormScore,
  resolveVisibleQuestionIds,
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
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    questions: [
      {
        id: sourceId,
        type: "single_choice",
        title: "Tem interesse?",
        required: true,
        options: [
          { value: "sim", label: "Sim", score: 10 },
          { value: "nao", label: "Não", score: -2 },
        ],
      },
      {
        id: targetId,
        type: "email",
        title: "E-mail",
        required: true,
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

  it("calcula pontos apenas pelas opções respondidas", () => {
    expect(calculatePublicFormScore(form(), [{ questionId: sourceId, value: "sim" }])).toBe(10)
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

  it("respeita maxSelections em multiple_choice", () => {
    const question = {
      ...form().questions[0],
      type: "multiple_choice" as const,
      options: [
        { id: "o1", value: "a", label: "A", score: 0 },
        { id: "o2", value: "b", label: "B", score: 0 },
        { id: "o3", value: "c", label: "C", score: 0 },
      ],
      config: { maxSelections: 2 },
    }
    expect(validateAnswer(question, ["a", "b"])).toBeNull()
    expect(validateAnswer(question, ["a", "b", "c"])).toBe("Selecione no máximo 2 opções")
  })
})
