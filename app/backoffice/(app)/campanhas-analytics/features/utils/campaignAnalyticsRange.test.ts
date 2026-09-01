import { describe, expect, it } from "bun:test"
import {
  buildCampaignAnalyticsRequestKey,
  buildDefaultCampaignAnalyticsFilters,
  validateCampaignAnalyticsRange,
} from "./campaignAnalyticsRange"

describe("validateCampaignAnalyticsRange", () => {
  it("aceita um período dentro do limite de 92 dias", () => {
    expect(validateCampaignAnalyticsRange("2026-08-01", "2026-08-31")).toBeNull()
  })

  it("T-11.2 — bloqueia range acima de 92 dias com a MESMA mensagem do backend", () => {
    const message = validateCampaignAnalyticsRange("2026-01-01", "2026-12-31")
    expect(message).toBe("O período não pode ultrapassar 92 dias — selecione um intervalo menor.")
  })

  it("aceita exatamente 92 dias (limite inclusive)", () => {
    // 2026-01-01 até 2026-04-02 = 92 dias fechados.
    expect(validateCampaignAnalyticsRange("2026-01-01", "2026-04-02")).toBeNull()
  })

  it("rejeita 93 dias", () => {
    expect(validateCampaignAnalyticsRange("2026-01-01", "2026-04-03")).not.toBeNull()
  })

  it("rejeita fim anterior ao início", () => {
    expect(validateCampaignAnalyticsRange("2026-08-31", "2026-08-01")).toBe(
      "O fim do período não pode ser anterior ao início do período."
    )
  })

  it("não valida quando algum dos dois ainda está vazio (aguardando seleção)", () => {
    expect(validateCampaignAnalyticsRange("", "2026-08-31")).toBeNull()
    expect(validateCampaignAnalyticsRange("2026-08-01", "")).toBeNull()
  })
})

describe("buildDefaultCampaignAnalyticsFilters", () => {
  it("usa os últimos 30 dias (inclusive) e nenhum time selecionado", () => {
    const filters = buildDefaultCampaignAnalyticsFilters(new Date("2026-08-31T12:00:00.000Z"))
    expect(filters.to).toBe("2026-08-31")
    expect(filters.from).toBe("2026-08-02")
    expect(filters.teamIds).toEqual([])
  })
})

describe("buildCampaignAnalyticsRequestKey", () => {
  it("é estável independentemente da ordem de teamIds", () => {
    const a = buildCampaignAnalyticsRequestKey({ from: "2026-08-01", to: "2026-08-31", teamIds: ["b", "a"] })
    const b = buildCampaignAnalyticsRequestKey({ from: "2026-08-01", to: "2026-08-31", teamIds: ["a", "b"] })
    expect(a).toBe(b)
  })

  it("muda quando o período ou os times mudam", () => {
    const base = buildCampaignAnalyticsRequestKey({ from: "2026-08-01", to: "2026-08-31", teamIds: [] })
    const otherPeriod = buildCampaignAnalyticsRequestKey({ from: "2026-08-02", to: "2026-08-31", teamIds: [] })
    const otherTeams = buildCampaignAnalyticsRequestKey({ from: "2026-08-01", to: "2026-08-31", teamIds: ["a"] })
    expect(base).not.toBe(otherPeriod)
    expect(base).not.toBe(otherTeams)
  })
})
