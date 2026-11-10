import { describe, expect, it } from "bun:test"
import { buildInterviewMessage, buildWhatsAppLink, formatInterviewLocal, normalizeWhatsAppPhone } from "./interview-whatsapp"

describe("buildInterviewMessage", () => {
  it("usa o primeiro nome, a administradora e o horário exatamente como foi digitado", () => {
    const message = buildInterviewMessage({
      clientName: "Maria Clara Souza",
      scheduledLocal: "2026-11-12T14:30",
      administratorName: "Qualicorp",
      brokerName: "Ana — Corretora Exemplo",
    })
    expect(message.startsWith("Olá, Maria!")).toBe(true)
    expect(message).toContain("a administradora Qualicorp")
    expect(message).toContain("quinta-feira, 12/11, às 14:30")
    expect(message.endsWith("Ana — Corretora Exemplo")).toBe(true)
  })

  it("sem administradora nem observação, mantém o texto genérico", () => {
    const message = buildInterviewMessage({ clientName: "", scheduledLocal: "2026-11-12T14:30", notes: "  " })
    expect(message.startsWith("Olá!")).toBe(true)
    expect(message).toContain("Agora a administradora vai fazer")
  })

  it("inclui a observação do corretor", () => {
    const message = buildInterviewMessage({ clientName: "Ana", scheduledLocal: "2026-11-12T14:30", notes: "Ligação pelo 0800." })
    expect(message).toContain("Ligação pelo 0800.")
  })
})

describe("formatInterviewLocal", () => {
  it("não aplica fuso: 23:30 continua 23:30 do mesmo dia", () => {
    expect(formatInterviewLocal("2026-11-12T23:30")).toBe("quinta-feira, 12/11, às 23:30")
  })
})

describe("normalizeWhatsAppPhone", () => {
  it("adiciona 55 em celular e fixo brasileiros", () => {
    expect(normalizeWhatsAppPhone("(11) 98765-4321")).toBe("5511987654321")
    expect(normalizeWhatsAppPhone("11 3456-7890")).toBe("551134567890")
  })

  it("mantém número que já tem DDI e recusa incompleto", () => {
    expect(normalizeWhatsAppPhone("+55 11 98765-4321")).toBe("5511987654321")
    expect(normalizeWhatsAppPhone("98765")).toBeNull()
  })
})

describe("buildWhatsAppLink", () => {
  it("monta o link wa.me com o texto codificado", () => {
    expect(buildWhatsAppLink("11987654321", "Olá, Ana!\nAté já")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20Ana!%0AAt%C3%A9%20j%C3%A1",
    )
  })

  it("sem telefone válido não gera link", () => {
    expect(buildWhatsAppLink("", "oi")).toBeNull()
  })
})
