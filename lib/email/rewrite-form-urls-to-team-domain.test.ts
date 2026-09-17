import { describe, expect, it } from "bun:test"
import { rewriteFormUrlHostsToBase } from "./rewrite-form-urls-to-team-domain"
import { extractFormPublicIdsFromHtml } from "./form-links-in-html"
import { appendEmailLogIdToFormUrls } from "./append-email-log-to-form-urls"

const TEAM_FORM_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_TEAM_FORM_ID = "33333333-3333-4333-8333-333333333333"
const BASE_URL = "https://forms.imobiliariax.com.br"
const ALLOWED = new Set([TEAM_FORM_ID])

describe("rewriteFormUrlHostsToBase", () => {
  it("troca o host de link absoluto congelado no template antigo", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${TEAM_FORM_ID}">Abrir</a>`
    const out = rewriteFormUrlHostsToBase(html, { baseUrl: BASE_URL, allowedPublicIds: ALLOWED })
    expect(out).toBe(`<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`)
  })

  it("preserva query e hash ao trocar o host", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${TEAM_FORM_ID}?utm_source=email&x=1#topo">Abrir</a>`
    const out = rewriteFormUrlHostsToBase(html, { baseUrl: BASE_URL, allowedPublicIds: ALLOWED })
    expect(out).toContain(`${BASE_URL}/forms/${TEAM_FORM_ID}?utm_source=email&x=1#topo`)
  })

  it("converte link relativo em absoluto no domínio do time", () => {
    const html = `<a href="/forms/${TEAM_FORM_ID}">Abrir</a>`
    const out = rewriteFormUrlHostsToBase(html, { baseUrl: BASE_URL, allowedPublicIds: ALLOWED })
    expect(out).toBe(`<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`)
  })

  it("NÃO troca host de formulário de outro time", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${OTHER_TEAM_FORM_ID}">Abrir</a>`
    const out = rewriteFormUrlHostsToBase(html, { baseUrl: BASE_URL, allowedPublicIds: ALLOWED })
    expect(out).toBe(html)
  })

  it("não altera HTML sem links de formulário nem com baseUrl inválida", () => {
    const plain = `<a href="https://example.com">x</a>`
    expect(rewriteFormUrlHostsToBase(plain, { baseUrl: BASE_URL, allowedPublicIds: ALLOWED })).toBe(
      plain,
    )
    const withForm = `<a href="/forms/${TEAM_FORM_ID}">x</a>`
    expect(
      rewriteFormUrlHostsToBase(withForm, { baseUrl: "not-a-url", allowedPublicIds: ALLOWED }),
    ).toBe(withForm)
  })

  it("compõe com a injeção de cs_el (host do time + tracking por destinatário)", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${TEAM_FORM_ID}">Abrir</a>`
    const rewritten = rewriteFormUrlHostsToBase(html, {
      baseUrl: BASE_URL,
      allowedPublicIds: ALLOWED,
    })
    const withLog = appendEmailLogIdToFormUrls(rewritten, "11111111-1111-4111-8111-111111111111")
    expect(withLog).toContain(
      `${BASE_URL}/forms/${TEAM_FORM_ID}?cs_el=11111111-1111-4111-8111-111111111111`,
    )
  })
})

describe("extractFormPublicIdsFromHtml", () => {
  it("extrai publicIds únicos, normalizados para lowercase", () => {
    const html = [
      `<a href="/forms/${TEAM_FORM_ID}">a</a>`,
      `<a href="https://x.com/forms/${TEAM_FORM_ID.toUpperCase()}">b</a>`,
      `<a href="/forms/${OTHER_TEAM_FORM_ID}?q=1">c</a>`,
    ].join("")
    const ids = extractFormPublicIdsFromHtml(html)
    expect(ids.sort()).toEqual([TEAM_FORM_ID, OTHER_TEAM_FORM_ID].sort())
  })

  it("retorna vazio sem links de formulário", () => {
    expect(extractFormPublicIdsFromHtml("<p>sem links</p>")).toEqual([])
  })
})
