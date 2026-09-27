import { describe, expect, it } from "bun:test"
import { formatEmailWarmupMessage, resolveEmailWarmupState } from "./warmup-policy"

describe("warmup-policy", () => {
  it("avança a indicação quando 80% do estágio foi usado", () => {
    const state = resolveEmailWarmupState({
      stage: 1,
      limit: 250,
      used: 200,
      health: "healthy",
      lastActivityAt: new Date("2026-09-25T12:00:00Z"),
    }, new Date("2026-09-26T12:00:00Z"))

    expect(state.limit).toBe(250)
    expect(state.shouldAdvance).toBe(true)
    expect(state.remaining).toBe(50)
  })

  it("pausa o envio quando a saúde está pausada", () => {
    const state = resolveEmailWarmupState({
      stage: 2,
      limit: 500,
      used: 20,
      health: "paused",
      lastActivityAt: null,
    })

    expect(state.status).toBe("paused")
    expect(state.shouldAdvance).toBe(false)
    expect(formatEmailWarmupMessage({ totalRecipients: 10, remaining: 480, limit: 500, health: "paused" })).toContain("Envio pausado")
  })

  it("reinicia no primeiro estágio após 30 dias sem atividade", () => {
    const state = resolveEmailWarmupState({
      stage: 4,
      limit: 2000,
      used: 0,
      health: "healthy",
      lastActivityAt: new Date("2026-08-20T12:00:00Z"),
    }, new Date("2026-09-26T12:00:00Z"))

    expect(state.stage).toBe(0)
    expect(state.limit).toBe(100)
  })

  it("não limita o domínio compartilhado da plataforma", () => {
    const state = resolveEmailWarmupState({
      stage: 0,
      limit: 100,
      used: 10,
      health: "healthy",
      lastActivityAt: null,
      isSharedPlatformDomain: true,
    })

    expect(state.status).toBe("established")
    expect(state.remaining).toBe(Number.MAX_SAFE_INTEGER)
  })
})
