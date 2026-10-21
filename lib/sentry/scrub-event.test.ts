import { describe, expect, it } from "bun:test"
import { redactProviderSecrets } from "@/lib/observability/redaction"
import { scrubSentryEvent, scrubSentryLog } from "./scrub-event"

const SECRET = "whsec_ultra_secret_value"
const WEBHOOK_URL = "https://app.example.com/api/v1/webhooks/payment-provider/abacate"
const WITH_QUERY = `${WEBHOOK_URL}?webhookSecret=${SECRET}`

describe("scrubSentryEvent em requisição de webhook", () => {
  it("remove a query da request e o segredo em TODOS os lugares do evento", () => {
    const event = scrubSentryEvent({
      request: { url: WITH_QUERY, query_string: `webhookSecret=${SECRET}`, headers: { referer: WITH_QUERY } },
      transaction: `POST ${WITH_QUERY}`,
      message: `falhou em ${WITH_QUERY}`,
      tags: { "http.url": WITH_QUERY, route: "x" },
      extra: { nested: { deep: [{ url: WITH_QUERY }, `webhookSecret=${SECRET}`] } },
      contexts: { trace: { data: { "http.target": `/api/v1/webhooks/payment-provider/abacate?webhookSecret=${SECRET}`, "url.query": `webhookSecret=${SECRET}`, "http.query": `webhookSecret=${SECRET}`, "url.full": WITH_QUERY } } },
      spans: [
        { description: `POST ${WITH_QUERY}`, data: { "http.url": WITH_QUERY, "url.query": `webhookSecret=${SECRET}` } },
      ],
      breadcrumbs: [{ message: `req ${WITH_QUERY}`, data: { url: WITH_QUERY } }],
      exception: { values: [{ value: `erro ${WITH_QUERY}` }] },
    })
    expect(JSON.stringify(event)).not.toContain(SECRET)
    expect(event.request.url).toBe(WEBHOOK_URL)
    expect(event.request.query_string).toBe("")
    expect(event.contexts.trace.data["url.query"]).toBe("")
    expect(event.contexts.trace.data["http.target"]).toBe("/api/v1/webhooks/payment-provider/abacate")
    expect(event.tags.route).toBe("x")
  })

  it("query_string como objeto ou array de pares também some", () => {
    const asObject = scrubSentryEvent({ request: { url: WITH_QUERY, query_string: { webhookSecret: SECRET } } })
    const asArray = scrubSentryEvent({ request: { url: WITH_QUERY, query_string: [["webhookSecret", SECRET]] } })
    expect(JSON.stringify([asObject, asArray])).not.toContain(SECRET)
  })
})

describe("scrubSentryEvent fora de webhook", () => {
  it("mascara só os parâmetros secretos e preserva o resto", () => {
    const event = scrubSentryEvent({ request: { url: "https://a.com/x?page=2&token=abc123", query_string: "page=2&token=abc123" } })
    expect(event.request.url).toBe("https://a.com/x?page=2&token=[redacted]")
    expect(event.request.query_string).toBe("page=2&token=[redacted]")
  })

  it("query_string objeto/array: redige cada chave secreta e mantém as demais", () => {
    const asObject = scrubSentryEvent({ request: { url: "https://a.com/x", query_string: { page: "2", token: "abc123" } } })
    expect(asObject.request.query_string).toEqual({ page: "2", token: "[redacted]" })
    const asArray = scrubSentryEvent({ request: { url: "https://a.com/x", query_string: [["page", "2"], ["apiKey", "k1"]] } })
    expect(asArray.request.query_string).toEqual([["page", "2"], ["apiKey", "[redacted]"]])
  })

  it("a decisão de webhook é só pelo caminho: URL alterada por redaction NÃO apaga a query", () => {
    const event = scrubSentryEvent({
      request: { url: "https://a.com/home?token=zzz&keep=1", query_string: "keep=1" },
    })
    expect(event.request.query_string).toBe("keep=1")
  })

  it("não altera eventos sem dados sensíveis", () => {
    const event = { message: "ok", request: { url: "https://a.com/home" }, tags: { a: "b" } }
    expect(scrubSentryEvent(event)).toEqual(event)
  })

  it("mascara chaves de provider em qualquer profundidade", () => {
    const event = scrubSentryEvent({
      message: "falhou com abc_prod_SECRETKEY123 e $aact_hmlg_000XYZ",
      extra: { a: [{ b: "bad key abc_dev_ZZZ999" }] },
      exception: { values: [{ value: "abc_prod_EXC1" }] },
    })
    const serialized = JSON.stringify(event)
    for (const leaked of ["SECRETKEY123", "000XYZ", "ZZZ999", "EXC1"]) expect(serialized).not.toContain(leaked)
  })
})

describe("redactProviderSecrets", () => {
  it("cobre segredo no INÍCIO da string, maiúsculas/minúsculas, ; e percent-encoding", () => {
    for (const input of [
      `webhookSecret=${SECRET}`,
      `WEBHOOKSECRET=${SECRET}&a=1`,
      `a=1;webhook_secret=${SECRET}`,
      `a=1&webhook%5Fsecret=${SECRET}`,
      `a=1&webhookSecret%3D${SECRET}`,
      `https://x.com/p?x=1&WebhookSecret=${SECRET}`,
    ]) {
      expect(redactProviderSecrets(input)).not.toContain(SECRET)
    }
    expect(redactProviderSecrets(`webhookSecret=${SECRET}&keep=1`)).toBe("webhookSecret=[redacted]&keep=1")
  })
})

describe("scrubSentryLog", () => {
  it("mascara chaves de provider na mensagem do log", () => {
    expect(scrubSentryLog({ message: "key abc_prod_LOGKEY1", level: "info" }).message).not.toContain("LOGKEY1")
  })
})
