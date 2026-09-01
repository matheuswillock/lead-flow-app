import { describe, expect, it } from "bun:test"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import { buildFormCompletionActivityBody } from "./form-completion-activity"

const snapshot = {
  questions: [
    { id: "q1", title: "Qual é o seu nome?" },
    { id: "q2", title: "Telefone" },
    { id: "q3", title: "Quais coberturas importam?" },
    { id: "q4", title: "Pergunta sem resposta" },
  ],
} as unknown as PublicFormSnapshot

describe("buildFormCompletionActivityBody", () => {
  it("abre com a identidade digitada e lista pergunta → resposta na ordem do formulário", () => {
    const body = buildFormCompletionActivityBody({
      snapshot,
      answers: [
        { questionId: "q1", value: "Alexandre" },
        { questionId: "q2", value: "(13) 99788-9618" },
        { questionId: "q3", value: ["Obstetrícia", "Oncologia"] },
      ],
      identity: {
        name: "Alexandre",
        phone: "(13) 99788-9618",
        email: "alexandre@libercorretora.com.br",
      },
    })

    expect(body).toBe(
      [
        "Nova resposta de formulário — Alexandre · (13) 99788-9618 · alexandre@libercorretora.com.br",
        "",
        "Qual é o seu nome?: Alexandre",
        "Telefone: (13) 99788-9618",
        "Quais coberturas importam?: Obstetrícia, Oncologia",
      ].join("\n"),
    )
  })

  it("respeita a visibilidade condicional e ignora resposta vazia", () => {
    const body = buildFormCompletionActivityBody({
      snapshot,
      answers: [
        { questionId: "q1", value: "Alexandre" },
        { questionId: "q2", value: "   " },
        { questionId: "q3", value: "Escondida" },
      ],
      visibleIds: new Set(["q1", "q2"]),
      identity: { name: "Alexandre" },
    })

    expect(body).toBe("Nova resposta de formulário — Alexandre\n\nQual é o seu nome?: Alexandre")
  })

  it("sem identidade e sem respostas sobra só o cabeçalho", () => {
    expect(buildFormCompletionActivityBody({ snapshot, answers: [] })).toBe(
      "Nova resposta de formulário",
    )
  })
})
