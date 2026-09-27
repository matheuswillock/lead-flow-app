import { describe, expect, it } from "bun:test"
import {
  evaluateEmailWarmupProgression,
  formatEmailWarmupMessage,
  resolveEmailWarmupState,
} from "./warmup-policy"

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

  it("recua um estágio após 30 dias sem atividade", () => {
    const state = resolveEmailWarmupState({
      stage: 4,
      limit: 2000,
      used: 0,
      health: "healthy",
      lastActivityAt: new Date("2026-08-20T12:00:00Z"),
    }, new Date("2026-09-26T12:00:00Z"))

    expect(state.stage).toBe(3)
    expect(state.limit).toBe(1000)
  })

  it("avança um único estágio após três dias elegíveis na janela de sete dias", () => {
    const decision = evaluateEmailWarmupProgression({
      stage: 1,
      health: "healthy",
      lastActivityAt: new Date("2026-09-26T12:00:00Z"),
      days: [
        { capacity: 250, sent: 220, delivered: 215, hardBounced: 2, softBounced: 2, complained: 0 },
        { capacity: 250, sent: 210, delivered: 205, hardBounced: 1, softBounced: 2, complained: 0 },
        { capacity: 250, sent: 230, delivered: 222, hardBounced: 2, softBounced: 3, complained: 0 },
      ],
    }, new Date("2026-09-27T12:00:00Z"))

    expect(decision.stage).toBe(2)
    expect(decision.action).toBe("advance")
  })

  it("não avança quando complaint ou bounce ultrapassa os limites", () => {
    const decision = evaluateEmailWarmupProgression({
      stage: 1,
      health: "healthy",
      lastActivityAt: new Date("2026-09-26T12:00:00Z"),
      days: [
        { capacity: 250, sent: 220, delivered: 190, hardBounced: 5, softBounced: 8, complained: 1 },
        { capacity: 250, sent: 220, delivered: 215, hardBounced: 1, softBounced: 2, complained: 0 },
        { capacity: 250, sent: 220, delivered: 215, hardBounced: 1, softBounced: 2, complained: 0 },
      ],
    })

    expect(decision.stage).toBe(1)
    expect(decision.action).toBe("hold")
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
