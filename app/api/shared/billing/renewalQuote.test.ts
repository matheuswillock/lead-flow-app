import { describe, expect, it } from "bun:test"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import {
  addMonths,
  quoteRenewalCycle,
  resolveActiveTeamAfterRevoke,
  resolveRenewedPeriod,
  resolveRevokedUserIds,
  type RenewalAccount,
} from "./renewalQuote"

const NOW = new Date("2026-11-07T12:00:00.000Z")

const monthly: SelfCheckoutCycleOption = {
  cycle: "monthly",
  label: "Mensal",
  months: 1,
  pixTotal: 59.9,
  monthlyEquivalent: 59.9,
  creditCardTotal: 62.9,
  maxInstallments: 1,
  extraUserMonthlyPrice: 19.9,
  extraTeamMonthlyPrice: 29.9,
}

const annual: SelfCheckoutCycleOption = {
  cycle: "annual",
  label: "Anual",
  months: 12,
  pixTotal: 599,
  monthlyEquivalent: 49.92,
  creditCardTotal: 659,
  maxInstallments: 18,
  extraUserMonthlyPrice: 19.9,
  extraTeamMonthlyPrice: 29.9,
}

function account(overrides: Partial<RenewalAccount> = {}): RenewalAccount {
  return {
    extraUsers: [
      { id: "u-ana", name: "Ana Souza", email: "ana@corretora.com.br", role: "operator" },
      { id: "u-caio", name: "Caio Lima", email: "caio@corretora.com.br", role: "manager" },
    ],
    teams: [{ name: "Corretora Exemplo" }, { name: "Time Saúde" }],
    hasManualUnlimitedUsers: false,
    currentCycle: "monthly",
    currentDueDate: new Date("2026-11-01T03:00:00.000Z"),
    ...overrides,
  }
}

describe("quoteRenewalCycle", () => {
  it("cobra plano + cada usuário e time adicional pelo nome, com preço único pelo período", () => {
    const quote = quoteRenewalCycle(monthly, account(), NOW)

    expect(quote.billedUsers.map((user) => user.email)).toEqual(["ana@corretora.com.br", "caio@corretora.com.br"])
    expect(quote.billedTeams).toEqual([{ name: "Time Saúde" }])
    expect(quote.extraUsersTotal).toBe(39.8)
    expect(quote.extraTeamsTotal).toBe(29.9)
    expect(quote.pixTotal).toBe(129.6)
    expect(quote.cardTotal).toBe(132.6)
  })

  it("usuário adicional cobra o valor mensal vezes os meses do prazo", () => {
    const quarterly: SelfCheckoutCycleOption = { ...monthly, cycle: "quarterly", label: "Trimestral", months: 3, pixTotal: 159.9 }
    const quote = quoteRenewalCycle(quarterly, account(), NOW)

    // 2 usuários x R$ 19,90 x 3 meses; o time continua com preço único do período
    expect(quote.extraUsersTotal).toBe(119.4)
    expect(quote.extraTeamsTotal).toBe(29.9)
    expect(quote.pixTotal).toBe(309.2)
  })

  it("o novo período começa no vencimento antigo, não na data do pagamento", () => {
    const quote = quoteRenewalCycle(monthly, account(), NOW)

    expect(quote.periodStart).toBe("2026-11-01T03:00:00.000Z")
    expect(quote.periodEnd).toBe("2026-12-01T03:00:00.000Z")
  })

  it("anual não cobra usuários e limita as parcelas aos meses do prazo", () => {
    const quote = quoteRenewalCycle(annual, account(), NOW)

    expect(quote.unlimitedUsers).toBe(true)
    expect(quote.billedUsers).toEqual([])
    expect(quote.pixTotal).toBe(628.9)
    expect(quote.maxInstallments).toBe(12)
  })

  it("quem é anual e renova num prazo menor é avisado de que perde o ilimitado", () => {
    const quote = quoteRenewalCycle(monthly, account({ currentCycle: "ANNUAL" }), NOW)

    expect(quote.losesUnlimitedUsers).toBe(true)
    expect(quote.billedUsers).toHaveLength(2)
  })

  it("ilimitado concedido pelo time interno continua grátis em qualquer prazo", () => {
    const quote = quoteRenewalCycle(monthly, account({ hasManualUnlimitedUsers: true }), NOW)

    expect(quote.unlimitedUsers).toBe(true)
    expect(quote.extraUsersTotal).toBe(0)
    expect(quote.losesUnlimitedUsers).toBe(false)
  })

  it("sem vencimento registrado, o período começa hoje", () => {
    const quote = quoteRenewalCycle(monthly, account({ currentDueDate: null }), NOW)

    expect(quote.periodStart).toBe(NOW.toISOString())
  })
})

describe("usuários mantidos na renovação", () => {
  it("cobra só quem o master manteve, inclusive manager, e revoga o resto", () => {
    const quote = quoteRenewalCycle(monthly, account(), NOW, ["u-caio"])

    expect(quote.billedUsers.map((user) => user.id)).toEqual(["u-caio"])
    expect(quote.accountUsers).toHaveLength(2)
    expect(quote.extraUsersTotal).toBe(19.9)
    expect(resolveRevokedUserIds(quote, account(), ["u-caio"])).toEqual(["u-ana"])
  })

  it("sem escolha, mantém todos e não revoga ninguém", () => {
    const quote = quoteRenewalCycle(monthly, account(), NOW)

    expect(quote.billedUsers).toHaveLength(2)
    expect(resolveRevokedUserIds(quote, account(), undefined)).toEqual([])
  })

  it("prazo com ilimitado nunca revoga, mesmo com escolha parcial", () => {
    const quote = quoteRenewalCycle(annual, account(), NOW, [])

    expect(resolveRevokedUserIds(quote, account(), [])).toEqual([])
  })
})

describe("resolveActiveTeamAfterRevoke", () => {
  it("quem estava num time da conta passa para o time que sobrou em outra conta", () => {
    expect(resolveActiveTeamAfterRevoke({
      activeTeamId: "team-conta-a",
      revokedTeamIds: ["team-conta-a", "team-conta-a-2"],
      remainingTeamIds: ["team-conta-b"],
    })).toBe("team-conta-b")
  })

  it("quem estava num time de outra conta continua nele", () => {
    expect(resolveActiveTeamAfterRevoke({
      activeTeamId: "team-conta-b",
      revokedTeamIds: ["team-conta-a"],
      remainingTeamIds: ["team-conta-b"],
    })).toBe("team-conta-b")
  })

  it("sem nenhum time restante, fica sem time ativo", () => {
    expect(resolveActiveTeamAfterRevoke({
      activeTeamId: "team-conta-a",
      revokedTeamIds: ["team-conta-a"],
      remainingTeamIds: [],
    })).toBeNull()
  })
})

describe("resolveRenewedPeriod", () => {
  it("soma o prazo escolhido ao vencimento antigo e grava o ciclo", () => {
    const result = resolveRenewedPeriod({ cycle: "quarterly", currentDueDate: new Date("2026-11-01T03:00:00.000Z"), now: NOW })

    expect(result.nextDueDate.toISOString()).toBe("2027-02-01T03:00:00.000Z")
    expect(result.cycle).toBe("quarterly")
  })

  it("regularização antiga sem prazo segue 30 dias a partir do pagamento", () => {
    const result = resolveRenewedPeriod({ cycle: "one-time", currentDueDate: new Date("2026-11-01T03:00:00.000Z"), now: NOW })

    expect(result.nextDueDate.toISOString()).toBe("2026-12-07T12:00:00.000Z")
    expect(result.cycle).toBeNull()
  })
})

describe("addMonths", () => {
  it("preserva o fim do mês", () => {
    expect(addMonths(new Date("2026-01-31T03:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T03:00:00.000Z")
  })
})
