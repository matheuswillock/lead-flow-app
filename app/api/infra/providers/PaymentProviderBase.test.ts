import { describe, expect, it, mock } from "bun:test"
import {
  PaymentProviderBase,
  type PaymentProviderDependencies,
  type ProviderLogger,
} from "./PaymentProviderBase"

class TestProvider extends PaymentProviderBase {
  constructor(dependencies: PaymentProviderDependencies = {}) {
    super("ABACATE_PAY", "DEV", { baseUrl: "https://api.abacatepay.com" }, dependencies)
  }

  request<T>(path: string, init: RequestInit) {
    return this.requestJson<T>(path, init)
  }

  logError(message: string, context: Record<string, unknown>) {
    this.logger.error(message, context)
  }
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe("PaymentProviderBase", () => {
  it("redacts sensitive logger context recursively", () => {
    const error = mock<ProviderLogger["error"]>(() => undefined)
    const provider = new TestProvider({ logger: { info: () => undefined, error } })

    provider.logError("provider failure", {
      authorization: "Bearer secret",
      cookie: "session=secret",
      cardNumber: "4111111111111111",
      card_number: "4111111111111111",
      cvc: "123",
      securityCode: "123",
      privateKey: "private-key",
      jwt: "jwt-token",
      credentials: "credentials",
      passphrase: "passphrase",
      webhookSigningKey: "hmac-secret",
      signingKey: "signing-secret",
      hmacKey: "hmac-secret",
      encryptionKey: "encryption-secret",
      hmac: "hmac-secret",
      cryptoKey: "crypto-secret",
      cryptographicKey: "cryptographic-secret",
      cipherKey: "cipher-secret",
      encryption: "encryption-secret",
      webhookSecret: "webhook-secret",
      nested: {
        cardToken: "ctok_sensitive",
        card_number: "4111111111111111",
        safe: "kept",
      },
    })

    expect(error).toHaveBeenCalledWith("provider failure", {
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      cardNumber: "[REDACTED]",
      card_number: "[REDACTED]",
      cvc: "[REDACTED]",
      securityCode: "[REDACTED]",
      privateKey: "[REDACTED]",
      jwt: "[REDACTED]",
      credentials: "[REDACTED]",
      passphrase: "[REDACTED]",
      webhookSigningKey: "[REDACTED]",
      signingKey: "[REDACTED]",
      hmacKey: "[REDACTED]",
      encryptionKey: "[REDACTED]",
      hmac: "[REDACTED]",
      cryptoKey: "[REDACTED]",
      cryptographicKey: "[REDACTED]",
      cipherKey: "[REDACTED]",
      encryption: "[REDACTED]",
      webhookSecret: "[REDACTED]",
      nested: {
        cardToken: "[REDACTED]",
        card_number: "[REDACTED]",
        safe: "kept",
      },
    })
    const circular: Record<string, unknown> = { safe: "kept" }
    circular.self = circular
    provider.logError("circular", { circular })
    expect(error).toHaveBeenLastCalledWith("circular", {
      circular: { safe: "kept", self: "[CIRCULAR]" },
    })
  })

  it("sanitizes remote errors while preserving only an allowlisted provider code", async () => {
    const error = mock<ProviderLogger["error"]>(() => undefined)
    const http = mock(async () =>
      response(
        {
          code: "SAFE_PROVIDER_CODE",
          authorization: "Bearer leaked",
          message: "raw provider details",
        },
        500,
      ),
    )
    const provider = new TestProvider({ http, logger: { info: () => undefined, error } })

    await expect(provider.request("/status", { method: "GET" })).rejects.toMatchObject({
      code: "REMOTE_REQUEST_FAILED",
      remoteCode: "SAFE_PROVIDER_CODE",
      remoteStatus: 500,
    })
    expect(error).toHaveBeenCalledWith("Falha segura na API do provedor", {
      provider: "ABACATE_PAY",
      status: 500,
      occurredAt: expect.any(String),
    })
  })

  it("uses the injected clock and configurable request deadline", async () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const http = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return response({ ok: true })
    })
    const provider = new TestProvider({ http, now: () => now, timeoutMs: 250 })

    await expect(provider.request("/status", { method: "GET" })).resolves.toEqual({ ok: true })
    expect(http).toHaveBeenCalledTimes(1)
  })

  it("enforces its deadline even when the caller supplies a non-aborting signal", async () => {
    const http = mock(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timeout", "TimeoutError")),
          )
        }),
    )
    const provider = new TestProvider({ http, timeoutMs: 5 })
    const externalController = new AbortController()

    await expect(
      provider.request("/slow", { method: "GET", signal: externalController.signal }),
    ).rejects.toMatchObject({ code: "REMOTE_TIMEOUT" })
  })

  it("does not classify an explicit caller abort as a retryable timeout", async () => {
    const controller = new AbortController()
    const http = mock(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("cancelled", "AbortError")),
          )
        }),
    )
    const provider = new TestProvider({ http, timeoutMs: 1000 })
    const request = provider.request("/cancelled", { method: "GET", signal: controller.signal })
    controller.abort()

    const caughtError = await request.catch((caught) => caught)
    const error = caughtError as { code: string; retryable: boolean }
    expect(error.code).toBe("REMOTE_REQUEST_FAILED")
    expect(error.retryable).toBe(false)
  })

  it("prioritizes explicit caller abort when timeout and abort race", async () => {
    const controller = new AbortController()
    const http = mock(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          setTimeout(() => controller.abort(), 0)
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    )
    const provider = new TestProvider({ http, timeoutMs: 50 })

    const request = provider.request("/race", { method: "GET", signal: controller.signal })
    const caughtError = await request.catch((caught) => caught)
    const error = caughtError as { code: string; retryable: boolean }

    expect(error.code).toBe("REMOTE_REQUEST_FAILED")
    expect(error.retryable).toBe(false)
  })

  it("rejects an already-aborted caller signal before invoking HTTP", async () => {
    const controller = new AbortController()
    controller.abort()
    const http = mock(async () => response({ ok: true }))
    const provider = new TestProvider({ http })

    const caughtError = await provider
      .request("/already-cancelled", { method: "GET", signal: controller.signal })
      .catch((caught) => caught)
    const error = caughtError as { code: string; retryable: boolean }

    expect(error.code).toBe("REMOTE_REQUEST_FAILED")
    expect(error.retryable).toBe(false)
    expect(http).not.toHaveBeenCalled()
  })

  it("rejects invalid JSON from a successful provider response", async () => {
    const http = mock(async () => new Response("not-json", { status: 200 }))
    const provider = new TestProvider({ http })

    await expect(provider.request("/invalid-json", { method: "GET" })).rejects.toMatchObject({
      code: "REMOTE_REQUEST_FAILED",
    })
  })

  it("rejects invalid timeout configuration", () => {
    expect(() => new TestProvider({ timeoutMs: 0 })).toThrow("Timeout")
    expect(() => new TestProvider({ timeoutMs: Number.NaN })).toThrow("Timeout")
    expect(() => new TestProvider({ timeoutMs: 2_147_483_648 })).toThrow("Timeout")
  })

  it("redacts sensitive values found in generic string fields", () => {
    const error = mock<ProviderLogger["error"]>(() => undefined)
    const provider = new TestProvider({ logger: { info: () => undefined, error } })

    provider.logError("Bearer message-token", {
      detail: "Bearer secret-token",
      payload: "sk-live-secret",
      values: [
        "credential=secret",
        "hmac=secret",
        "encryption=secret",
        "access_token=secret",
        "api_key=secret",
        "client_secret=secret",
        "refresh_token=secret",
        "secret_key=secret",
        "session_token=secret",
        "filter[token]=secret",
        "user[password]=secret",
        "api.key=secret",
        "webhook.signing.key=secret",
        "auth=secret",
        "x-auth=secret",
        "pin=1234",
        "otp=123456",
        "key=secret",
        "auth-code=123456",
        "token-id=supersecret",
        "otp-code=123456",
        "x-auth-code=abc123",
        "authorization-code=xyz",
        "card number=4111111111111111",
        "security code=123",
        "Bearer:secret",
        "bearer=secret",
        "private key=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq\n-----END PRIVATE KEY-----",
        "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
        "x-api-key: secret",
        "x-api-key=secret",
        "x_api_key=secret",
        "xApiKey=secret",
        "signature: secret",
        "signature=secret",
        "x_signature=secret",
        "xSignature=secret",
        "authorization: secret with spaces",
        "cookie=secret with spaces",
        "cardNumber=4111 1111 1111 1111",
        "securityCode=123 456",
        "accessToken=secret",
        "cardToken=secret",
        "webhookSecret=secret",
        "privateKey=secret",
        "signingKey=secret",
        "webhookSigningKey=secret",
        '"accessToken":"secret with spaces"',
        '"webhookSecret":"another secret with spaces"',
        "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.",
        "amount: 100",
        "token = secret",
        "token='secret'",
        '{"nested":{"token":"x"}}',
        "occurredAt=2026-10-17T12:00:00.000Z",
        "safe",
      ],
      jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      jwe: "eyJhbGciOiJub25lIn0.payload.key.iv.tag",
      jweWithEmptySegment: "eyJhbGciOiJkaXIifQ..ciphertext.iv.tag",
      jwtEndingInDash: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature-",
      jsonPayload: '{"accessToken":"secret","webhookSecret":"secret"}',
      jsonAliases: '{"clientSecret":"abc","refreshToken":"def"}',
      jsonScalars: '{"token":123,"password":null}',
    })

    expect(error).toHaveBeenCalledWith("Bearer [REDACTED]", {
      detail: "Bearer [REDACTED]",
      payload: "[REDACTED]",
      values: [
        "credential=[REDACTED]",
        "hmac=[REDACTED]",
        "encryption=[REDACTED]",
        "access_token=[REDACTED]",
        "api_key=[REDACTED]",
        "client_secret=[REDACTED]",
        "refresh_token=[REDACTED]",
        "secret_key=[REDACTED]",
        "session_token=[REDACTED]",
        "filter[token]=[REDACTED]",
        "user[password]=[REDACTED]",
        "api.key=[REDACTED]",
        "webhook.signing.key=[REDACTED]",
        "auth=[REDACTED]",
        "x-auth=[REDACTED]",
        "pin=[REDACTED]",
        "otp=[REDACTED]",
        "key=[REDACTED]",
        "auth-code=[REDACTED]",
        "token-id=[REDACTED]",
        "otp-code=[REDACTED]",
        "x-auth-code=[REDACTED]",
        "authorization-code=[REDACTED]",
        "card number=[REDACTED]",
        "security code=[REDACTED]",
        "Bearer:[REDACTED]",
        "bearer=[REDACTED]",
        "private key=[REDACTED]",
        "[REDACTED]",
        "x-api-key: [REDACTED]",
        "x-api-key=[REDACTED]",
        "x_api_key=[REDACTED]",
        "xApiKey=[REDACTED]",
        "signature: [REDACTED]",
        "signature=[REDACTED]",
        "x_signature=[REDACTED]",
        "xSignature=[REDACTED]",
        "authorization: [REDACTED]",
        "cookie=[REDACTED]",
        "cardNumber=[REDACTED]",
        "securityCode=[REDACTED]",
        "accessToken=[REDACTED]",
        "cardToken=[REDACTED]",
        "webhookSecret=[REDACTED]",
        "privateKey=[REDACTED]",
        "signingKey=[REDACTED]",
        "webhookSigningKey=[REDACTED]",
        '"accessToken":"[REDACTED]"',
        '"webhookSecret":"[REDACTED]"',
        "[REDACTED]",
        "amount: 100",
        "token = [REDACTED]",
        "token='[REDACTED]'",
        '{"nested":{"token":"[REDACTED]"}}',
        "occurredAt=2026-10-17T12:00:00.000Z",
        "safe",
      ],
      jwt: "[REDACTED]",
      jwe: "[REDACTED]",
      jweWithEmptySegment: "[REDACTED]",
      jwtEndingInDash: "[REDACTED]",
      jsonPayload: '{"accessToken":"[REDACTED]","webhookSecret":"[REDACTED]"}',
      jsonAliases: '{"clientSecret":"[REDACTED]","refreshToken":"[REDACTED]"}',
      jsonScalars: '{"token":[REDACTED]',
    })
  })

  it("enforces the deadline while consuming a slow response body", async () => {
    const http = mock(
      async () => ({ ok: true, status: 200, json: () => new Promise(() => undefined) }) as Response,
    )
    const provider = new TestProvider({ http, timeoutMs: 5 })

    await expect(provider.request("/slow-body", { method: "GET" })).rejects.toMatchObject({
      code: "REMOTE_TIMEOUT",
    })
  })
})
