import { describe, expect, test } from "bun:test"
import { appendEmailLogIdToLandingPageUrls } from "./append-email-log-to-landing-page-urls"

const LANDING_ID = "11111111-1111-4111-8111-111111111111"
const LOG_ID = "22222222-2222-4222-8222-222222222222"

describe("appendEmailLogIdToLandingPageUrls", () => {
  test("anexa cs_el em links de cotação absolutos e relativos", () => {
    const html = `<a href="https://cotacao.cliente.com.br/conversation/${LANDING_ID}?utm_source=email">Cotar</a><a href='/conversation/${LANDING_ID}'>Outra</a>`

    expect(appendEmailLogIdToLandingPageUrls(html, LOG_ID)).toContain(
      `conversation/${LANDING_ID}?utm_source=email&cs_el=${LOG_ID}`,
    )
    expect(appendEmailLogIdToLandingPageUrls(html, LOG_ID)).toContain(
      `/conversation/${LANDING_ID}?cs_el=${LOG_ID}`,
    )
  })

  test("não altera links de landing com ID inválido", () => {
    const html = `<a href="https://example.com/conversation/not-a-uuid">Inválido</a>`

    expect(appendEmailLogIdToLandingPageUrls(html, LOG_ID)).toBe(html)
  })
})
