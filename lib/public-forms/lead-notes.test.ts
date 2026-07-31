import { describe, expect, it } from "bun:test"
import { createDefaultThankYouPage } from "./thank-you-pages"
import { mergeFormMappedLeadNotes } from "./lead-notes"
import type { PublicFormSnapshot } from "./types"

const defaultThanks = createDefaultThankYouPage()

function snapshot(): PublicFormSnapshot {
  return {
    formId: "form-1",
    publicId: "pub-1",
    version: 1,
    publishedAt: new Date().toISOString(),
    name: "Qualificação",
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Ok",
    successActions: [],
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
    formKind: "standard",
    questions: [
      {
        id: "q-notes",
        type: "text",
        title: "Observações",
        required: false,
        scoreWeight: 0,
        position: 0,
        config: {},
        options: [],
        mappingTarget: "notes",
      },
    ],
  }
}

describe("mergeFormMappedLeadNotes", () => {
  it("preserva notas não gerenciadas pelo formulário", () => {
    const merged = mergeFormMappedLeadNotes(
      "Nota manual do corretor",
      snapshot(),
      ["Observações: resposta atual"],
    )
    expect(merged).toBe("Nota manual do corretor\nObservações: resposta atual")
  })

  it("substitui linhas do formulário em sincronizações repetidas", () => {
    const existing = "Nota manual do corretor\nObservações: valor antigo"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), ["Observações: valor novo"])
    expect(merged).toBe("Nota manual do corretor\nObservações: valor novo")
  })

  it("não duplica notas quando progresso e submissão enviam as mesmas respostas", () => {
    const afterProgress = mergeFormMappedLeadNotes(null, snapshot(), ["Observações: mesma resposta"])
    const afterSubmit = mergeFormMappedLeadNotes(afterProgress, snapshot(), ["Observações: mesma resposta"])
    expect(afterSubmit).toBe("Observações: mesma resposta")
  })

  it("substitui nota de qualificação sem duplicar", () => {
    const existing = "Qualificação: Faixa A\nNota manual"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), ["Qualificação: Faixa B"])
    expect(merged).toBe("Nota manual\nQualificação: Faixa B")
  })

  it("preserva notas gerenciadas ausentes em progresso parcial", () => {
    const existing = "Qualificação: Faixa A\nObservações: valor antigo"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), ["Observações: valor parcial"])
    expect(merged).toBe("Qualificação: Faixa A\nObservações: valor parcial")
  })

  it("remove bloco multilinha inteiro ao substituir nota mapeada", () => {
    const existing = "Nota manual\nObservações: linha 1\n  linha 2"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), ["Observações: valor atualizado"])
    expect(merged).toBe("Nota manual\nObservações: valor atualizado")
  })

  it("preserva continuação indentada de textarea mapeado", () => {
    const existing = "Observações: linha 1\n  linha 2"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), [
      "Observações: nova linha 1\n  nova linha 2",
    ])
    expect(merged).toBe("Observações: nova linha 1\n  nova linha 2")
  })

  it("não altera notas existentes quando não há linhas novas", () => {
    const existing = "Qualificação: Faixa A\nObservações: mantida"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), [])
    expect(merged).toBe(existing)
  })

  it("remove nota mapeada quando resposta opcional é limpa", () => {
    const existing = "Nota manual\nObservações: valor antigo"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), ["Observações: "])
    expect(merged).toBe("Nota manual")
  })

  it("preserva linha indentada com outro prefixo dentro de textarea multilinha", () => {
    const existing = "Observações: linha 1\n  Qualificação: citada pelo usuário"
    const merged = mergeFormMappedLeadNotes(existing, snapshot(), ["Qualificação: Faixa B"])
    expect(merged).toBe(
      "Observações: linha 1\n  Qualificação: citada pelo usuário\nQualificação: Faixa B",
    )
  })
})
