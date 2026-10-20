import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const consumePublicFormRateLimit = mock(async (_key: string, _options: { limit: number; windowMs: number }) => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
mock.module("@/lib/public-forms/rate-limit", () => ({ consumePublicFormRateLimit }))

const execute = mock(async (_input: { ip?: string | null }) => new Output(true, ["ok"], [], null))
mock.module("@/app/api/useCases/passwordResetAudit/PasswordResetTelemetryUseCase", () => ({
  passwordResetTelemetryUseCase: { execute },
}))

const { POST } = await import("./route")

const FLOW_ID = "11111111-1111-4111-8111-111111111111"
const SECRET = "audit-secret"
const hashed = (ip: string) => createHmac("sha256", SECRET).update(ip).digest("hex")

function post(headers: Record<string, string> = {}, body: unknown = { flowId: FLOW_ID, eventType: "page_opened" }) {
  return POST(
    new NextRequest("http://localhost/api/v1/auth/password-reset/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  )
}

const saved = { VERCEL: process.env.VERCEL, NODE_ENV: process.env.NODE_ENV, SECRET: process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET }
// process.env.NODE_ENV é somente leitura nos tipos do Next; o helper evita a asserção em cada uso.
const setEnv = (key: "VERCEL" | "NODE_ENV", value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>
  if (value === undefined) delete env[key]
  else env[key] = value
}

beforeEach(() => {
  consumePublicFormRateLimit.mockClear()
  execute.mockClear()
  process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET = SECRET
  setEnv("VERCEL", "1")
  setEnv("NODE_ENV", "production")
})

afterEach(() => {
  setEnv("VERCEL", saved.VERCEL)
  setEnv("NODE_ENV", saved.NODE_ENV)
  if (saved.SECRET === undefined) delete process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET
  else process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET = saved.SECRET
})

describe("POST /auth/password-reset/telemetry — IP e limite de requisições", () => {
  it("na Vercel usa o IP confiável e ignora o x-forwarded-for forjado", async () => {
    await post({ "x-vercel-id": "gru1::abc", "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.77" })

    expect(consumePublicFormRateLimit).toHaveBeenCalledTimes(1)
    expect(consumePublicFormRateLimit.mock.calls[0][0]).toBe(`password-reset-telemetry:ip:${hashed("203.0.113.9")}`)
    expect(execute.mock.calls[0][0].ip).toBe("203.0.113.9")
  })

  it("rotacionar o x-forwarded-for não muda o balde nem o IP auditado", async () => {
    for (const forged of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
      await post({ "x-vercel-id": "gru1::abc", "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": forged })
    }

    const keys = new Set(consumePublicFormRateLimit.mock.calls.map(([key]) => key))
    expect(keys.size).toBe(1)
    expect(new Set(execute.mock.calls.map(([input]) => input.ip))).toEqual(new Set(["203.0.113.9"]))
  })

  it("sem IP confiável aplica o limite por fluxo e o teto compartilhado, sem usar cabeçalho do cliente", async () => {
    await post({ "x-forwarded-for": "198.51.100.77", "x-real-ip": "198.51.100.78" })

    expect(consumePublicFormRateLimit.mock.calls.map(([key]) => key)).toEqual([
      `password-reset-telemetry:flow:${FLOW_ID}`,
      "password-reset-telemetry:unattributed",
    ])
    expect(consumePublicFormRateLimit.mock.calls[1][1].limit).toBeGreaterThan(consumePublicFormRateLimit.mock.calls[0][1].limit)
    expect(execute.mock.calls[0][0].ip).toBeNull()
  })

  it("sem o segredo de hash também cai no limite por fluxo, mesmo com IP confiável", async () => {
    delete process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET

    await post({ "x-vercel-id": "gru1::abc", "x-vercel-forwarded-for": "203.0.113.9" })

    expect(consumePublicFormRateLimit.mock.calls[0][0]).toBe(`password-reset-telemetry:flow:${FLOW_ID}`)
  })

  it("não consulta o teto compartilhado quando o limite por fluxo já estourou", async () => {
    consumePublicFormRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 })

    const response = await post({})

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("12")
    expect(consumePublicFormRateLimit).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejeita payload inválido antes de consumir qualquer limite", async () => {
    const response = await post({}, { flowId: "nao-e-uuid", eventType: "page_opened" })

    expect(response.status).toBe(400)
    expect(consumePublicFormRateLimit).not.toHaveBeenCalled()
  })
})
