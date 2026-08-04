import { describe, expect, test } from "bun:test"
import type { PublicFormDraftInput } from "./types"
import {
  previewTemperatureForOption,
  type FormEngagementConfig,
} from "./temperature-preview"
import { DEFAULT_FORM_ENGAGEMENT_SCORE_RULES } from "@/lib/radar/engagement-score"

const CONFIG: FormEngagementConfig = {
  formCompletedBaseWeight: 25,
  formEngagementScoreRules: DEFAULT_FORM_ENGAGEMENT_SCORE_RULES,
}

function choiceForm(): PublicFormDraftInput {
  return {
    name: "Qualificação",
    assignedSdrId: null,
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Concluído",
    successActions: [],
    thankYouPages: [
      {
        id: "ty-1",
        name: "Padrão",
        title: "Obrigado",
        isDefault: true,
        actions: [],
      },
    ],
    defaultThankYouPageId: "ty-1",
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    questions: [
      {
        id: "q1",
        type: "single_choice",
        title: "Orçamento",
        required: true,
        scoreWeight: 100,
        options: [
          {
            id: "opt-high",
            label: "Alto",
            value: "alto",
            score: 100,
            scorePolarity: "positive",
          },
          {
            id: "opt-low",
            label: "Baixo",
            value: "baixo",
            score: 80,
            scorePolarity: "negative",
          },
        ],
      },
    ],
    rules: [],
    scoreBands: [],
  }
}

describe("previewTemperatureForOption", () => {
  test("opção score 100 positivo com peso 100 → hot", () => {
    const band = previewTemperatureForOption(choiceForm(), "q1", "opt-high", CONFIG)
    expect(band).toBe("hot")
  })

  test("opção negativa de alta intensidade → cold", () => {
    const band = previewTemperatureForOption(choiceForm(), "q1", "opt-low", {
      ...CONFIG,
      formCompletedBaseWeight: 20,
    })
    expect(band).toBe("cold")
  })

  test("sem config retorna null", () => {
    expect(previewTemperatureForOption(choiceForm(), "q1", "opt-high", null)).toBeNull()
  })

  test("formulário sem scoreWeight retorna null", () => {
    const form = choiceForm()
    form.questions[0]!.scoreWeight = 0
    expect(previewTemperatureForOption(form, "q1", "opt-high", CONFIG)).toBeNull()
  })
})
