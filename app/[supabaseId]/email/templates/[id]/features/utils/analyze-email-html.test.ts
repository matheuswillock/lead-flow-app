import { describe, expect, it } from "bun:test"
import { analyzeEmailHtml } from "@/app/[supabaseId]/email/templates/[id]/features/utils/analyze-email-html"

describe("analyzeEmailHtml", () => {
  it("detecta SVG inline", () => {
    const alerts = analyzeEmailHtml('<svg width="16" height="16"></svg>')
    expect(alerts.some((a) => a.id === "inline-svg")).toBe(true)
  })

  it("detecta ausência de tabelas", () => {
    const alerts = analyzeEmailHtml("<div>Olá</div>")
    expect(alerts.some((a) => a.id === "missing-tables")).toBe(true)
  })

  it("não alerta HTML com tabelas e sem SVG", () => {
    const alerts = analyzeEmailHtml(
      '<table role="presentation"><tr><td style="background-color:#fff;">Texto</td></tr></table>'
    )
    expect(alerts.some((a) => a.id === "inline-svg")).toBe(false)
    expect(alerts.some((a) => a.id === "missing-tables")).toBe(false)
  })
})
