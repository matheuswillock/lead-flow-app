import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { isPublicFormRequestOriginAllowed } from "./request-origin-guard"

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

function requestWithOrigin(origin: string | null) {
  const headers = new Headers()
  if (origin) headers.set("origin", origin)
  return new Request("https://example.com/api/v1/public-forms/x/progress", {
    method: "POST",
    headers,
  })
}

describe("isPublicFormRequestOriginAllowed", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.corretorstudio.com.br"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
  })

  it("permite request sem header Origin (same-origin legítimo pode omitir)", () => {
    expect(isPublicFormRequestOriginAllowed(requestWithOrigin(null))).toBe(true)
  })

  it("permite quando a origem bate com NEXT_PUBLIC_APP_URL", () => {
    expect(
      isPublicFormRequestOriginAllowed(requestWithOrigin("https://app.corretorstudio.com.br")),
    ).toBe(true)
  })

  it("bloqueia origem de outro domínio (script externo forjando POST)", () => {
    expect(isPublicFormRequestOriginAllowed(requestWithOrigin("https://malicioso.com"))).toBe(false)
  })

  it("bloqueia porta/subdomínio diferente", () => {
    expect(
      isPublicFormRequestOriginAllowed(requestWithOrigin("https://outro.corretorstudio.com.br")),
    ).toBe(false)
  })

  it("permite (fail-safe) quando NEXT_PUBLIC_APP_URL não está configurada", () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(isPublicFormRequestOriginAllowed(requestWithOrigin("https://qualquer.com"))).toBe(true)
  })
})
