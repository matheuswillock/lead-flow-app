import { describe, expect, it } from "bun:test"
import { extractFormPublicIdsFromHtml } from "@/lib/email/detect-template-form"

describe("detect-template-form", () => {
  it("extrai publicId de URL /forms/{uuid} no HTML", () => {
    const publicId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    const html = `<a href="https://app.example.com/forms/${publicId}">Responder</a>`
    expect(extractFormPublicIdsFromHtml(html)).toEqual([publicId])
  })

  it("retorna vazio quando não há link de formulário", () => {
    expect(extractFormPublicIdsFromHtml("<p>Sem formulário</p>")).toEqual([])
  })
})
