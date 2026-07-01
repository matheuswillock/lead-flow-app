import { describe, expect, it } from "bun:test"
import { analyzeEmailHtml } from "@/app/[supabaseId]/email/templates/[id]/features/utils/analyze-email-html"

describe("analyzeEmailHtml", () => {
  it("detecta SVG inline com contagem", () => {
    const alerts = analyzeEmailHtml('<svg width="16"></svg><svg height="16"></svg>')
    const svgAlert = alerts.find((a) => a.id === "inline-svg")
    expect(svgAlert).toBeDefined()
    expect(svgAlert?.title).toContain("PNG ou JPG")
    expect(svgAlert?.detail).toContain("2")
  })

  it("detecta ausência de tabelas", () => {
    const alerts = analyzeEmailHtml("<div>Olá</div>")
    expect(alerts.some((a) => a.id === "missing-tables")).toBe(true)
  })

  it("detecta no-reply no conteúdo", () => {
    const alerts = analyzeEmailHtml("Contato: no-reply@empresa.com")
    expect(alerts.some((a) => a.id === "no-reply-in-content")).toBe(true)
  })

  it("detecta links fora do domínio de envio", () => {
    const alerts = analyzeEmailHtml(
      '<a href="https://wa.me/5511999999999">WhatsApp</a>',
      "corretorstudio.com"
    )
    expect(alerts.some((a) => a.id === "link-domain-mismatch")).toBe(true)
  })

  it("não alerta HTML com tabelas e sem SVG", () => {
    const alerts = analyzeEmailHtml(
      '<table role="presentation"><tr><td style="background-color:#fff;">Texto</td></tr></table>'
    )
    expect(alerts.some((a) => a.id === "inline-svg")).toBe(false)
    expect(alerts.some((a) => a.id === "missing-tables")).toBe(false)
  })
})
