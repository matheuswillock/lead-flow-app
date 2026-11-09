import type { SelfCheckoutCycle, SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"

/**
 * Usuário adicional da conta: qualquer membro dos times do master além dele, seja operador ou
 * manager (o manager é cobrado como usuário comum).
 */
export type RenewalBilledUser = { id: string; name: string; email: string; role: string }
/** Time cobrado como adicional (todos os times da conta, exceto o incluído no plano). */
export type RenewalBilledTeam = { name: string }

export type RenewalAccount = {
  /** Usuários da conta além do master (o master é o usuário incluído no plano). */
  extraUsers: RenewalBilledUser[]
  /** Times da conta em ordem de criação; o primeiro é o incluído no plano. */
  teams: RenewalBilledTeam[]
  /** Ilimitado concedido pelo time interno (não pelo plano anual). Member PRO não conta. */
  hasManualUnlimitedUsers: boolean
  /** Ciclo atual como gravado no perfil (monthly, annual... ou legados em maiúsculas). */
  currentCycle: string | null
  currentDueDate: Date | null
}

export type RenewalCycleQuote = {
  cycle: SelfCheckoutCycle
  label: string
  months: number
  /** Início do novo período: o vencimento antigo (ou hoje, se não houver). */
  periodStart: string
  periodEnd: string
  planPixTotal: number
  planCardTotal: number | null
  maxInstallments: number
  unlimitedUsers: boolean
  /** Usuários adicionais cobrados neste prazo (vazio quando há ilimitado). */
  billedUsers: RenewalBilledUser[]
  /** Todos os usuários adicionais da conta, para o master escolher quem manter. */
  accountUsers: RenewalBilledUser[]
  billedTeams: RenewalBilledTeam[]
  extraUserPrice: number
  extraTeamPrice: number
  extraUsersTotal: number
  extraTeamsTotal: number
  pixTotal: number
  cardTotal: number | null
  /** A conta tem usuários ilimitados hoje e perde ao renovar neste prazo. */
  losesUnlimitedUsers: boolean
}

const roundMoney = (value: number) => Math.round(value * 100) / 100
const ANNUAL_CYCLES = new Set(["annual", "yearly"])

export function currentlyHasUnlimitedUsers(account: Pick<RenewalAccount, "hasManualUnlimitedUsers" | "currentCycle">): boolean {
  return account.hasManualUnlimitedUsers || ANNUAL_CYCLES.has(account.currentCycle?.toLowerCase() ?? "")
}

/** Soma meses no calendário, preservando o dia (31/01 + 1 mês = 28/02 ou 29/02). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

/**
 * Cotação da renovação para um prazo: mesmos preços do checkout (plano + adicionais com preço
 * único pelo período). O anual e o ilimitado concedido pelo time interno não cobram usuários.
 * O novo período começa no vencimento antigo, para quem paga atrasado não ganhar dias.
 */
export function quoteRenewalCycle(
  option: SelfCheckoutCycleOption,
  account: RenewalAccount,
  now: Date,
  /** Usuários que o master mantém; ausente = todos. Sem efeito quando o prazo tem ilimitado. */
  keptUserIds?: readonly string[],
): RenewalCycleQuote {
  const unlimitedUsers = option.cycle === "annual" || account.hasManualUnlimitedUsers
  const kept = keptUserIds ? new Set(keptUserIds) : null
  const billedUsers = unlimitedUsers ? [] : account.extraUsers.filter((user) => !kept || kept.has(user.id))
  const billedTeams = account.teams.slice(1)
  const extraUserPrice = option.extraUserMonthlyPrice ?? 0
  const extraTeamPrice = option.extraTeamMonthlyPrice ?? 0
  const extraUsersTotal = roundMoney(billedUsers.length * extraUserPrice)
  const extraTeamsTotal = roundMoney(billedTeams.length * extraTeamPrice)
  const extras = roundMoney(extraUsersTotal + extraTeamsTotal)
  const periodStart = account.currentDueDate ?? now
  const planCardTotal = option.creditCardTotal ?? null

  return {
    cycle: option.cycle,
    label: option.label,
    months: option.months,
    periodStart: periodStart.toISOString(),
    periodEnd: addMonths(periodStart, option.months).toISOString(),
    planPixTotal: option.pixTotal,
    planCardTotal,
    maxInstallments: Math.max(1, Math.min(option.maxInstallments ?? 1, option.months)),
    unlimitedUsers,
    billedUsers,
    accountUsers: account.extraUsers,
    billedTeams,
    extraUserPrice,
    extraTeamPrice,
    extraUsersTotal,
    extraTeamsTotal,
    pixTotal: roundMoney(option.pixTotal + extras),
    cardTotal: planCardTotal == null ? null : roundMoney(planCardTotal + extras),
    losesUnlimitedUsers: currentlyHasUnlimitedUsers(account) && !unlimitedUsers,
  }
}

/**
 * Quem sai da conta ao confirmar a renovação: os usuários adicionais que o master não manteve.
 * Prazo com ilimitado não revoga ninguém (todos seguem sem custo).
 */
export function resolveRevokedUserIds(
  quote: Pick<RenewalCycleQuote, "unlimitedUsers">,
  account: Pick<RenewalAccount, "extraUsers">,
  keptUserIds: readonly string[] | undefined,
): string[] {
  if (quote.unlimitedUsers || !keptUserIds) return []
  const kept = new Set(keptUserIds)
  return account.extraUsers.filter((user) => !kept.has(user.id)).map((user) => user.id)
}

/**
 * Time ativo de quem foi revogado: se o ativo era da conta que revogou, passa para o primeiro
 * time que sobrou (de outra conta); sem nenhum, fica sem time ativo. Senão, não muda.
 */
export function resolveActiveTeamAfterRevoke(input: {
  activeTeamId: string | null
  revokedTeamIds: readonly string[]
  remainingTeamIds: readonly string[]
}): string | null {
  if (!input.activeTeamId || !input.revokedTeamIds.includes(input.activeTeamId)) return input.activeTeamId
  return input.remainingTeamIds.find((teamId) => !input.revokedTeamIds.includes(teamId)) ?? null
}

const CYCLE_MONTHS: Readonly<Record<SelfCheckoutCycle, number>> = {
  monthly: 1,
  quarterly: 3,
  quadrimester: 4,
  semiannual: 6,
  annual: 12,
}

function isRenewalCycle(cycle: string): cycle is SelfCheckoutCycle {
  return Object.prototype.hasOwnProperty.call(CYCLE_MONTHS, cycle)
}

/**
 * Vencimento depois do pagamento: o prazo escolhido somado ao vencimento antigo. Regularizações
 * antigas, sem prazo gravado ("one-time"), mantêm a regra anterior de 30 dias a partir do pagamento.
 */
export function resolveRenewedPeriod(input: { cycle: string; currentDueDate: Date | null; now: Date }): {
  nextDueDate: Date
  cycle: SelfCheckoutCycle | null
} {
  if (!isRenewalCycle(input.cycle)) {
    return { nextDueDate: new Date(input.now.getTime() + 30 * 24 * 60 * 60 * 1000), cycle: null }
  }
  return {
    nextDueDate: addMonths(input.currentDueDate ?? input.now, CYCLE_MONTHS[input.cycle]),
    cycle: input.cycle,
  }
}

export function quoteRenewal(options: SelfCheckoutCycleOption[], account: RenewalAccount, now: Date): RenewalCycleQuote[] {
  return options.map((option) => quoteRenewalCycle(option, account, now))
}
