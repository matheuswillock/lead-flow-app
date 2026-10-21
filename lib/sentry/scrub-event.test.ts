import { describe, expect, it } from "bun:test"
import { scrubSentryEvent } from "./scrub-event"

const WEBHOOK_SECRET = "whsec_ultra_secret_value"

describe("scrubSentryEvent", () => {
  it("remove a query de URLs de webhook", () => {
    const event = scrubSentryEvent({
      request: {
        url: `https://app.example.com/api/v1/webhooks/payment-provider/abacate?webhookSecret=${WEBHOOK_SECRET}`,
        query_string: `webhookSecret=${WEBHOOK_SECRET}`,
      },
    })
    expect(event.request.url).toBe("https://app.example.com/api/v1/webhooks/payment-provider/abacate")
    expect(event.request.query_string).toBe("")
    expect(JSON.stringify(event)).not.toContain(WEBHOOK_SECRET)
  })

  it("mascara parâmetros secretos em URLs comuns e preserva o resto", () => {
    const event = scrubSentryEvent({ request: { url: "https://a.com/x?page=2&token=abc123" } })
    expect(event.request.url).toBe("https://a.com/x?page=2&token=[redacted]")
  })

  it("mascara chaves de provider em mensagem, exceção, breadcrumbs e transação", () => {
    const event = scrubSentryEvent({
      message: "falhou com abc_prod_SECRETKEY123 e $aact_hmlg_000XYZ",
      transaction: `POST /api/v1/webhooks/payment-provider/abacate?webhookSecret=${WEBHOOK_SECRET}`,
      exception: { values: [{ value: "bad key abc_dev_ZZZ999" }] },
      breadcrumbs: [
        { message: "req abc_prod_BREAD", data: { url: `https://x.com/webhooks/a?webhookSecret=${WEBHOOK_SECRET}` } },
      ],
    })
    const serialized = JSON.stringify(event)
    for (const leaked of ["SECRETKEY123", "000XYZ", WEBHOOK_SECRET, "ZZZ999", "BREAD"]) {
      expect(serialized).not.toContain(leaked)
    }
  })

  it("não altera eventos sem dados sensíveis", () => {
    const event = { message: "ok", request: { url: "https://a.com/home" } }
    expect(scrubSentryEvent(event)).toEqual(event)
  })
})

describe("scrubSentryLog", () => {
  it("mascara chaves de provider na mensagem do log", async () => {
    const { scrubSentryLog } = await import("./scrub-event")
    expect(scrubSentryLog({ message: "key abc_prod_LOGKEY1", level: "info" }).message).not.toContain("LOGKEY1")
  })
})
