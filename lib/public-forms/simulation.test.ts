import { describe, expect, test } from "bun:test"
import { runHealthPlanSimulation } from "./simulation"
import { createDefaultThankYouPage } from "./thank-you-pages"
import type { PublicFormSnapshot } from "./types"

const defaultThanks = createDefaultThankYouPage({ id: "55555555-5555-4555-8555-555555555555" })

function snapshot(partial: Partial<PublicFormSnapshot> & { questions: PublicFormSnapshot["questions"] }): PublicFormSnapshot {
  return {
    formId: "f",
    publicId: "p",
    version: 1,
    publishedAt: new Date().toISOString(),
    name: "Sim",
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Ok",
    thankYouPages: [defaultThanks],
    defaultThankYouPageId: defaultThanks.id,
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    rules: [],
    scoreBands: [],
    theme: {
      backgroundColor: "#fff",
      textColor: "#111",
      lineColor: "#eee",
      accentColor: "#FF6900",
      buttonTextColor: "#FFFFFF",
      inputBackgroundColor: "#FFFFFF",
    },
    successActions: [],
    formKind: "health_plan_simulator",
    ...partial,
  }
}

describe("runHealthPlanSimulation", () => {
  test("returns priced options for multi-life profile", () => {
    const form = snapshot({
      questions: [
        {
          id: "q-name",
          type: "text",
          title: "Nome",
          required: true,
          scoreWeight: 25,
          position: 0,
          options: [],
          mappingTarget: "native_field",
          mappingKey: "name",
        },
        {
          id: "q-valor",
          type: "currency",
          title: "Valor",
          required: true,
          scoreWeight: 25,
          position: 1,
          options: [],
          mappingTarget: "native_field",
          mappingKey: "currentValue",
        },
        {
          id: "q-op",
          type: "health_plan",
          title: "Operadora",
          required: true,
          scoreWeight: 25,
          position: 2,
          options: [{ label: "Amil", value: "Amil", score: 0, scorePolarity: "positive" }],
          mappingTarget: "native_field",
          mappingKey: "currentHealthPlan",
        },
        {
          id: "q-tempo",
          type: "single_choice",
          title: "Tempo",
          required: true,
          scoreWeight: 25,
          position: 3,
          options: [
            { label: "2 a 4 anos", value: "2 a 4 anos", score: 0, scorePolarity: "positive" },
            { label: "Mais de 4 anos", value: "Mais de 4 anos", score: 0, scorePolarity: "positive" },
          ],
        },
      ],
    })
    const result = runHealthPlanSimulation(form, {
      "q-name": "Maria Silva",
      "q-valor": "2.500,00",
      "q-op": "Amil",
      "q-tempo": "2 a 4 anos",
    })
    expect(result.firstName).toBe("Maria")
    expect(result.reajustePct).toBeGreaterThan(0)
    expect(result.prices.length).toBeGreaterThan(0)
    expect(result.prices[0]?.novoFmt).toContain(",")
  })
})
