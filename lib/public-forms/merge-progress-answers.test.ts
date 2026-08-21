import { describe, expect, it } from "bun:test"
import { mergeProgressAnswers } from "./merge-progress-answers"

describe("mergeProgressAnswers", () => {
  it("acumula blur de uma pergunta com respostas já persistidas", () => {
    const merged = mergeProgressAnswers({
      stored: [{ questionId: "name", value: "Maria Silva" }],
      incoming: [{ questionId: "phone", value: "(11) 98888-7777" }],
    })

    expect(merged).toEqual([
      { questionId: "name", value: "Maria Silva" },
      { questionId: "phone", value: "(11) 98888-7777" },
    ])
  })

  it("não sobrescreve valor preenchido com blur vazio", () => {
    const merged = mergeProgressAnswers({
      stored: [{ questionId: "name", value: "Maria Silva" }],
      incoming: [{ questionId: "name", value: "   " }],
    })

    expect(merged).toEqual([{ questionId: "name", value: "Maria Silva" }])
  })

  it("substitui valor armazenado quando o incoming tem conteúdo", () => {
    const merged = mergeProgressAnswers({
      stored: [{ questionId: "name", value: "Maria" }],
      incoming: [{ questionId: "name", value: "Maria Silva" }],
    })

    expect(merged).toEqual([{ questionId: "name", value: "Maria Silva" }])
  })
})
