import { describe, expect, it } from "bun:test"
import { rewriteFormUrlHostsToBase } from "./rewrite-form-urls-to-team-domain"
import { extractFormPublicIdsFromHtml } from "./form-links-in-html"
import { appendEmailLogIdToFormUrls } from "./append-email-log-to-form-urls"
import type { FormsHostEnv } from "@/lib/proxy/forms-host"

const TEAM_FORM_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_TEAM_FORM_ID = "33333333-3333-4333-8333-333333333333"
const BASE_URL = "https://forms.imobiliariax.com.br"
const ALLOWED = new Set([TEAM_FORM_ID])

/** Env explícita: o teste não pode depender do NEXT_PUBLIC_APP_URL do runner. */
const ENV: FormsHostEnv = {
  appUrl: "https://www.corretorstudio.com",
  fallbackHost: "forms.host-neutro.com.br",
}

function rewrite(html: string) {
  return rewriteFormUrlHostsToBase(html, { baseUrl: BASE_URL, allowedPublicIds: ALLOWED, env: ENV })
}

describe("rewriteFormUrlHostsToBase", () => {
  it("troca o host de link absoluto congelado no template antigo", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${TEAM_FORM_ID}">Abrir</a>`
    expect(rewrite(html)).toBe(`<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`)
  })

  it("preserva query e hash ao trocar o host", () => {
    const html = `<a href="https://corretorstudio.com/forms/${TEAM_FORM_ID}?utm_source=email&x=1#topo">Abrir</a>`
    expect(rewrite(html)).toContain(`${BASE_URL}/forms/${TEAM_FORM_ID}?utm_source=email&x=1#topo`)
  })

  it("converte link relativo em absoluto no domínio do time", () => {
    const html = `<a href="/forms/${TEAM_FORM_ID}">Abrir</a>`
    expect(rewrite(html)).toBe(`<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`)
  })

  it("troca host de link que já aponta para o próprio domínio de forms (re-disparo)", () => {
    const html = `<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`
    expect(rewrite(html)).toBe(`<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`)
  })

  it("troca host de link no host neutro de fallback", () => {
    const html = `<a href="https://forms.host-neutro.com.br/forms/${TEAM_FORM_ID}">Abrir</a>`
    expect(rewrite(html)).toBe(`<a href="${BASE_URL}/forms/${TEAM_FORM_ID}">Abrir</a>`)
  })

  it("NÃO troca host de formulário de outro time", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${OTHER_TEAM_FORM_ID}">Abrir</a>`
    expect(rewrite(html)).toBe(html)
  })

  it("CTA externo passa intacto byte a byte (ClickUp, Typeform, WhatsApp)", () => {
    const clickup = `<a href="https://forms.clickup.com/36148174/f/12abcd-999/AAAA">Formulário ClickUp</a>`
    const typeform = `<a href="https://imobx.typeform.com/to/a1B2c3">Typeform</a>`
    const whatsapp = `<a href="https://wa.me/5511999999999?text=Oi">WhatsApp</a>`
    for (const html of [clickup, typeform, whatsapp]) {
      expect(rewrite(html)).toBe(html)
    }
  })

  it("host externo com path /forms/{uuid} NOSSO não é trocado (host não é nosso)", () => {
    // Wrapper/página de terceiro embutindo o uuid do nosso form: host manda.
    const html = `<a href="https://site-do-cliente.com.br/forms/${TEAM_FORM_ID}">Ver</a>`
    expect(rewrite(html)).toBe(html)
  })

  it("host nosso com path que não é exatamente /forms/{uuid} não é trocado", () => {
    const html = `<a href="https://www.corretorstudio.com/embed/forms/${TEAM_FORM_ID}">Ver</a>`
    expect(rewrite(html)).toBe(html)
  })

  it("não altera HTML sem links de formulário nem com baseUrl inválida", () => {
    const plain = `<a href="https://example.com">x</a>`
    expect(rewrite(plain)).toBe(plain)
    const withForm = `<a href="/forms/${TEAM_FORM_ID}">x</a>`
    expect(
      rewriteFormUrlHostsToBase(withForm, {
        baseUrl: "not-a-url",
        allowedPublicIds: ALLOWED,
        env: ENV,
      }),
    ).toBe(withForm)
  })

  it("compõe com a injeção de cs_el (host do time + tracking por destinatário)", () => {
    const html = `<a href="https://www.corretorstudio.com/forms/${TEAM_FORM_ID}">Abrir</a>`
    const rewritten = rewrite(html)
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
