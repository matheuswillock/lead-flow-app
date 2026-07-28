import { describe, expect, it } from "bun:test"
import {
  distributeEvenWeights,
  rebalanceAfterQuestionWeightEdit,
  redistributeQuestionScoresEvenly,
} from "./scoring"
import type { PublicFormQuestionInput } from "./types"

function q(id: string, scoreWeight: number): PublicFormQuestionInput {
  return {
    id,
    type: "text",
    title: id,
    required: false,
    scoreWeight,
    options: [],
  }
}

describe("scoring helpers", () => {
  it("distribui pesos inteiros que somam exatamente o total", () => {
    expect(distributeEvenWeights(3, 100)).toEqual([34, 33, 33])
    expect(distributeEvenWeights(1, 100)).toEqual([100])
    expect(distributeEvenWeights(0, 100)).toEqual([])
  })

  it("redistribui perguntas para soma 100", () => {
    const next = redistributeQuestionScoresEvenly([q("a", 0), q("b", 0), q("c", 0)])
    expect(next.map((item) => item.scoreWeight).reduce((sum, n) => sum + n, 0)).toBe(100)
  })

  it("rebalanceia as demais ao editar um peso", () => {
    const questions = redistributeQuestionScoresEvenly([q("a", 0), q("b", 0), q("c", 0)])
    const next = rebalanceAfterQuestionWeightEdit(questions, "a", 50)
    expect(next.find((item) => item.id === "a")?.scoreWeight).toBe(50)
    expect(next.reduce((sum, item) => sum + item.scoreWeight, 0)).toBe(100)
  })
})
