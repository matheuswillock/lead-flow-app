import { describe, expect, it, mock } from "bun:test"
import { OperationalAlerter, redactSensitiveUrls } from "./operational-alerts"

function build(nowMs = { value: 1_000_000 }) {
  const captureMessage = mock((_message: string, _options?: unknown) => "id")
  const slack = mock(async (_input: unknown) => undefined)
  const log = mock((_name: string, _context: unknown) => undefined)
  const alerter = new OperationalAlerter({
    sentry: { captureMessage },
    slack,
    log,
    now: () => new Date(nowMs.value),
  })
  return { alerter, captureMessage, slack, log, nowMs }
}

describe("redactSensitiveUrls", () => {
  it("removes the webhookSecret value wherever it appears", () => {
    const text = "fetch failed https://x.app/api/hook?webhookSecret=abc123&foo=1 and webhookSecret=zzz"
    const out = redactSensitiveUrls(text)
    expect(out).not.toContain("abc123")
    expect(out).not.toContain("zzz")
  })

  it("drops the whole query string of any URL", () => {
    expect(redactSensitiveUrls("GET https://a.b/c?token=s3cr3t#frag failed")).toBe(
      "GET https://a.b/c?[redacted] failed",
    )
  })
})

describe("OperationalAlerter", () => {
  it("logs and sends to Sentry with the requested level and tags", async () => {
    const { alerter, captureMessage, log } = build()
    await alerter.alert({ key: "k1", message: "algo", level: "warning", context: { a: 1 } })
    expect(log).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]?.[1]).toMatchObject({
      level: "warning",
      tags: { alertKey: "k1" },
      extra: { a: 1 },
    })
  })

  it("dedupes the same key inside the window and releases after it", async () => {
    const { alerter, captureMessage, nowMs } = build()
    const input = { key: "k", message: "m", level: "warning" as const, dedupeWindowMs: 60_000 }
    await alerter.alert(input)
    await alerter.alert(input)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    nowMs.value += 60_001
    await alerter.alert(input)
    expect(captureMessage).toHaveBeenCalledTimes(2)
  })

  it("dedupes by dedupeKey when given, so distinct events of the same alert key still notify", async () => {
    const { alerter, captureMessage } = build()
    const base = { key: "k", message: "m", level: "warning" as const, dedupeWindowMs: 60_000 }
    await alerter.alert({ ...base, dedupeKey: "k:a:1" })
    await alerter.alert({ ...base, dedupeKey: "k:a:1" })
    await alerter.alert({ ...base, dedupeKey: "k:a:2" })
    expect(captureMessage).toHaveBeenCalledTimes(2)
  })

  it("only notifies Slack when asked and never throws if Slack fails", async () => {
    const { alerter, slack } = build()
    await alerter.alert({ key: "a", message: "m", level: "error" })
    expect(slack).not.toHaveBeenCalled()
    slack.mockImplementationOnce(async () => {
      throw new Error("slack down")
    })
    await expect(alerter.alert({ key: "b", message: "m", level: "error", slack: true })).resolves.toBeUndefined()
    expect(slack).toHaveBeenCalledTimes(1)
  })

  it("redacts urls from message and context before logging or sending", async () => {
    const { alerter, captureMessage, log } = build()
    await alerter.alert({
      key: "r",
      message: "erro https://h/x?webhookSecret=SEGREDO",
      level: "error",
      context: { url: "https://h/x?webhookSecret=SEGREDO" },
    })
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain("SEGREDO")
    expect(JSON.stringify(log.mock.calls)).not.toContain("SEGREDO")
  })
})
