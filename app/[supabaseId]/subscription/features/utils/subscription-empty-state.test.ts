import { describe, expect, it } from "bun:test"
import {
  resolveSubscriptionEmptyStateReason,
  SUBSCRIPTION_PENDING_CHANGE_WINDOW_MS,
} from "./subscription-empty-state"

describe("resolveSubscriptionEmptyStateReason (T-21.2 / DA2)", () => {
  it("nunca viu assinatura ativa neste navegador → 'none' (CTA de criar continua fazendo sentido)", () => {
    expect(resolveSubscriptionEmptyStateReason({ lastSeenSubscriptionAt: null })).toBe("none")
  })

  it("viu assinatura ativa há 1 minuto e o GET agora volta null → 'pending-change' (janela dual-account)", () => {
    const now = 1_000_000
    const lastSeenSubscriptionAt = now - 60_000
    expect(resolveSubscriptionEmptyStateReason({ lastSeenSubscriptionAt, now })).toBe("pending-change")
  })

  it("no limite exato da janela ainda conta como 'pending-change'", () => {
    const now = 1_000_000
    const lastSeenSubscriptionAt = now - SUBSCRIPTION_PENDING_CHANGE_WINDOW_MS
    expect(resolveSubscriptionEmptyStateReason({ lastSeenSubscriptionAt, now })).toBe("pending-change")
  })

  it("passou da janela (ex.: cancelamento de verdade há 1h) → 'none'", () => {
    const now = 1_000_000
    const lastSeenSubscriptionAt = now - SUBSCRIPTION_PENDING_CHANGE_WINDOW_MS - 1
    expect(resolveSubscriptionEmptyStateReason({ lastSeenSubscriptionAt, now })).toBe("none")
  })

  it("timestamp no futuro (relógio do cliente adiantado) não quebra — trata como 'none'", () => {
    const now = 1_000_000
    expect(resolveSubscriptionEmptyStateReason({ lastSeenSubscriptionAt: now + 1000, now })).toBe("none")
  })
})
