import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { isPublicFormRequestOriginAllowed } from "./request-origin-guard"

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

function requestWithOrigin(origin: string | null, hostHeaders?: Record<string, string>) {
  const headers = new Headers()
  if (origin) headers.set("origin", origin)
  for (const [key, value] of Object.entries(hostHeaders ?? {})) {
    headers.set(key, value)
  }
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

  it("permite same-origin em domínio de formulários do time (host == origin)", () => {
    expect(
      isPublicFormRequestOriginAllowed(
        requestWithOrigin("https://forms.imobiliariax.com.br", {
          host: "forms.imobiliariax.com.br",
        }),
      ),
    ).toBe(true)
  })

  it("permite same-origin atrás de proxy (x-forwarded-host)", () => {
    expect(
      isPublicFormRequestOriginAllowed(
        requestWithOrigin("https://forms.imobiliariax.com.br", {
          host: "127.0.0.1:3000",
          "x-forwarded-host": "forms.imobiliariax.com.br",
        }),
      ),
    ).toBe(true)
  })

  it("segue bloqueando origem externa mesmo com host custom no request", () => {
    expect(
      isPublicFormRequestOriginAllowed(
        requestWithOrigin("https://malicioso.com", {
          host: "forms.imobiliariax.com.br",
        }),
      ),
    ).toBe(false)
  })
})
