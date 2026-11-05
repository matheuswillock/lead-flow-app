import { describe, expect, it } from "bun:test"
import type { Breadcrumb, Event } from "@sentry/nextjs"
import {
  redactWebhookSecretInText,
  scrubWebhookSecretFromBreadcrumb,
  scrubWebhookSecretFromEvent,
} from "./scrubWebhookSecret"

const SECRET = "SENTINELA_SEGREDO"
const URL_WITH_SECRET = `https://app.example.com/api/v1/webhooks/payment-provider/abacate?webhookSecret=${SECRET}`

function serialized(value: unknown): string {
  return JSON.stringify(value)
}

describe("redactWebhookSecretInText", () => {
  it("troca o valor de webhookSecret na query preservando o resto", () => {
    expect(redactWebhookSecretInText(`${URL_WITH_SECRET}&x=1`)).toBe(
      "https://app.example.com/api/v1/webhooks/payment-provider/abacate?webhookSecret=[redacted]&x=1",
    )
  })

  it("cobre o parâmetro depois de outros e em query_string pura", () => {
    expect(redactWebhookSecretInText(`a=1&webhookSecret=${SECRET}`)).toBe("a=1&webhookSecret=[redacted]")
    expect(redactWebhookSecretInText(`webhookSecret=${SECRET}`)).toBe("webhookSecret=[redacted]")
  })

  it("não mexe em texto sem webhookSecret", () => {
    expect(redactWebhookSecretInText("https://app.example.com/api/v1/leads?x=1")).toBe(
      "https://app.example.com/api/v1/leads?x=1",
    )
  })
})

describe("scrubWebhookSecretFromEvent", () => {
  it("limpa request.url, query_string (string, objeto e pares) e referer", () => {
    const asString = scrubWebhookSecretFromEvent<Event>({
      request: { url: URL_WITH_SECRET, query_string: `webhookSecret=${SECRET}`, headers: { referer: URL_WITH_SECRET } },
    })
    const asObject = scrubWebhookSecretFromEvent<Event>({
      request: { query_string: { webhookSecret: SECRET, x: "1" } },
    })
    const asPairs = scrubWebhookSecretFromEvent<Event>({
      request: { query_string: [["webhookSecret", SECRET], ["x", "1"]] },
    })

    expect(serialized(asString)).not.toContain(SECRET)
    expect(asString.request?.query_string).toBe("webhookSecret=[redacted]")
    expect(asObject.request?.query_string).toEqual({ webhookSecret: "[redacted]", x: "1" })
    expect(asPairs.request?.query_string).toEqual([["webhookSecret", "[redacted]"], ["x", "1"]])
  })

  it("limpa o header Referer com qualquer capitalização", () => {
    const event = scrubWebhookSecretFromEvent<Event>({ request: { headers: { Referer: URL_WITH_SECRET } } })
    expect(serialized(event)).not.toContain(SECRET)
  })

  it("limpa transação, breadcrumbs, spans, contexto de trace e mensagens de exceção", () => {
    const event = scrubWebhookSecretFromEvent({
      transaction: `POST ${URL_WITH_SECRET}`,
      breadcrumbs: [{ message: URL_WITH_SECRET, data: { url: URL_WITH_SECRET, status: 500 } }],
      spans: [{ description: `POST ${URL_WITH_SECRET}`, data: { "url.full": URL_WITH_SECRET } }],
      contexts: { trace: { trace_id: "t", span_id: "s", data: { "http.url": URL_WITH_SECRET } } },
      exception: { values: [{ type: "Error", value: `falha em ${URL_WITH_SECRET}` }] },
    } as unknown as Event)

    expect(serialized(event)).not.toContain(SECRET)
    expect(event.breadcrumbs?.[0]?.data?.status).toBe(500)
  })

  it("devolve o evento intacto quando não há segredo", () => {
    const event: Event = { request: { url: "https://app.example.com/api/v1/leads?x=1" } }
    expect(scrubWebhookSecretFromEvent(event)).toEqual({ request: { url: "https://app.example.com/api/v1/leads?x=1" } })
  })
})

describe("scrubWebhookSecretFromBreadcrumb", () => {
  it("limpa URL em message e em qualquer string de data (fetch/xhr/navigation)", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      message: URL_WITH_SECRET,
      data: { url: URL_WITH_SECRET, from: URL_WITH_SECRET, to: URL_WITH_SECRET, status_code: 202 },
    }
    const scrubbed = scrubWebhookSecretFromBreadcrumb(breadcrumb)

    expect(serialized(scrubbed)).not.toContain(SECRET)
    expect(scrubbed.data?.status_code).toBe(202)
  })
})
