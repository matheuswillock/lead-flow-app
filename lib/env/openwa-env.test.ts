import { describe, expect, it } from "bun:test"
import { envSchema } from "./validation"

const openWaKeys = ["OPENWA_API_URL", "OPENWA_API_KEY", "OPENWA_WEBHOOK_SECRET"] as const

describe("envSchema OpenWA (Spec 01)", () => {
  it("define OPENWA_API_URL, OPENWA_API_KEY e OPENWA_WEBHOOK_SECRET no schema", () => {
    const shape = envSchema.shape as Record<string, unknown>
    for (const key of openWaKeys) {
      expect(shape[key]).toBeDefined()
    }
  })

  it("não inclui EVO_API_BASE_URL nem EVO_API_KEY no schema Zod", () => {
    const shape = envSchema.shape as Record<string, unknown>
    expect(shape.EVO_API_BASE_URL).toBeUndefined()
    expect(shape.EVO_API_KEY).toBeUndefined()
  })

  it("valida OPENWA_WEBHOOK_SECRET com mínimo de 32 caracteres", () => {
    const secretSchema = envSchema.shape.OPENWA_WEBHOOK_SECRET
    expect(secretSchema.safeParse("curto").success).toBe(false)
    expect(secretSchema.safeParse("s".repeat(32)).success).toBe(true)
  })

  it("valida OPENWA_API_URL como URL", () => {
    const urlField = envSchema.shape.OPENWA_API_URL
    expect(urlField.safeParse("not-a-url").success).toBe(false)
    expect(urlField.safeParse("http://127.0.0.1:3333").success).toBe(true)
  })
})

describe("WhatsAppConnectionStatus INITIALIZING", () => {
  it("aceita INITIALIZING como status de domínio", async () => {
    const { WhatsAppConnectionStatus, WhatsAppEngine } = await import("@prisma/client")
    expect(WhatsAppConnectionStatus.INITIALIZING).toBe("INITIALIZING")
    expect(WhatsAppEngine.OPENWA).toBe("OPENWA")
    expect(WhatsAppEngine.META).toBe("META")
  })
})
