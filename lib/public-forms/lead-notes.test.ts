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
})
