import { describe, expect, it } from "bun:test"
import { EMPTY_FILTERS } from "@/lib/planSimulator/planSimulator"
import { PlanQuoteUseCase, PLAN_QUOTE_MESSAGES } from "./PlanQuoteUseCase"

const scope = { teamId: "team-1", ownerProfileId: "profile-1" }

function stateWith(lives: number[], sel: string[]) {
  return { lives, uf: "SP", filters: EMPTY_FILTERS, sel }
}

function build(state: unknown) {
  const calls = { createShare: 0, snapshotPlans: 0 }
  const quotes = {
    list: async () => [],
    findOwned: async () => ({ id: "q1", nome: "Padaria", state, resumo: null, createdAt: new Date(), updatedAt: new Date() }),
    create: async () => { throw new Error("não usado") },
    update: async () => { throw new Error("não usado") },
    delete: async () => {},
    createShare: async () => { calls.createShare += 1; return { id: "s1", token: "t", createdAt: new Date() } },
    findShareByToken: async () => null,
  }
  const simulator = {
    snapshotPlans: async () => {
      calls.snapshotPlans += 1
      return [{ chave: "abc", total: 100 }]
    },
  }
  const useCase = new PlanQuoteUseCase(quotes as never, {} as never, simulator as never)
  return { useCase, calls }
}

describe("PlanQuoteUseCase.share", () => {
  it("recusa o link quando a cotação não tem vidas, sem gerar snapshot", async () => {
    const { useCase, calls } = build(stateWith([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], ["abc"]))
    const out = await useCase.share("q1", scope)
    expect(out.isValid).toBe(false)
    expect(out.errorMessages).toContain(PLAN_QUOTE_MESSAGES.NO_LIVES)
    expect(calls.snapshotPlans).toBe(0)
    expect(calls.createShare).toBe(0)
  })

  it("recusa quando não há planos escolhidos", async () => {
    const { useCase, calls } = build(stateWith([2, 0, 0, 0, 0, 0, 0, 0, 0, 0], []))
    const out = await useCase.share("q1", scope)
    expect(out.errorMessages).toContain(PLAN_QUOTE_MESSAGES.NO_PLANS)
    expect(calls.createShare).toBe(0)
  })

  it("cria o link quando há vidas e planos", async () => {
    const { useCase, calls } = build(stateWith([2, 0, 0, 0, 0, 0, 0, 0, 0, 0], ["abc"]))
    const out = await useCase.share("q1", scope)
    expect(out.isValid).toBe(true)
    expect((out.result as { token: string }).token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(calls.createShare).toBe(1)
  })
})
