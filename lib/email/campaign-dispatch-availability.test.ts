import { describe, expect, it } from "bun:test"
import { resolveDispatchAvailability } from "./campaign-dispatch-availability"
import type { DailyEmailCapResult } from "./campaign-daily-dispatch-guard"

const TZ = "America/Sao_Paulo"
const NOW = new Date("2026-09-10T14:00:00.000Z")

function makeDailyStatus(overrides: Partial<DailyEmailCapResult> = {}): DailyEmailCapResult {
  return {
    exceeded: false,
    used: 0,
    limit: 2000,
    remaining: 2000,
    isUnlimited: false,
    ...overrides,
  }
}

describe("resolveDispatchAvailability", () => {
  it("bloqueia com reason=dispatch_in_progress quando status=sending, mesmo dentro do teto", () => {
    const availability = resolveDispatchAvailability({
      status: "sending",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 10 }),
      additionalRecipients: 5,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(false)
    expect(availability.reason).toBe("dispatch_in_progress")
  })

  /**
   * Bug medido em produção (achado desta rodada): status "sent" antes desta
   * mudança não tinha motivo nomeado nenhum — o botão ficava ativo e um clique
   * reenviava para TODA a audiência de novo (retryFailedOnly só se aplica a
   * failed/partially_sent). "already_sent" fecha essa porta.
   */
  it("bloqueia com reason=already_sent quando status=sent (risco de re-disparo acidental)", () => {
    const availability = resolveDispatchAvailability({
      status: "sent",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 10 }),
      additionalRecipients: 500,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(false)
    expect(availability.reason).toBe("already_sent")
  })

  it("bloqueia com reason=monthly_quota_active quando a cota mensal está ativa, mesmo com teto diário livre", () => {
    const availability = resolveDispatchAvailability({
      status: "failed",
      monthlyQuotaActive: true,
      dailyStatus: makeDailyStatus({ used: 0 }),
      additionalRecipients: 100,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(false)
    expect(availability.reason).toBe("monthly_quota_active")
  })

  /**
   * Caso real medido em produção (time "Planos de Saúde Inteligente | Rafael",
   * 09/09): 2.000/2.000 já usados no dia — qualquer parte adicional estoura.
   */
  it("bloqueia com reason=daily_cap_reached quando o disparo estouraria o teto diário", () => {
    const availability = resolveDispatchAvailability({
      status: "scheduled",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 2000, limit: 2000, remaining: 0 }),
      additionalRecipients: 2000,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(false)
    expect(availability.reason).toBe("daily_cap_reached")
    expect(availability.dailyCap).toBe(2000)
    expect(availability.sentToday).toBe(2000)
  })

  /**
   * Cenário de STARVATION EM CASCATA medido em produção (time Rafael, 10/09):
   * a parte represada de ontem dispara às 00:00 e consome 1.998/2.000; sobram
   * só 2 e-mails de teto para o resto do dia. Uma parte de 2.000 destinatários
   * agendada para hoje 08:00 é adiada mesmo com o "teto" tecnicamente não
   * zerado — 1.998 + 2.000 > 2.000.
   */
  it("bloqueia por teto quase esgotado (starvation em cascata) e expõe o consumo exato (1998/2000)", () => {
    const availability = resolveDispatchAvailability({
      status: "scheduled",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 1998, limit: 2000, remaining: 2 }),
      additionalRecipients: 2000,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(false)
    expect(availability.reason).toBe("daily_cap_reached")
    expect(availability.sentToday).toBe(1998)
    expect(availability.dailyCap).toBe(2000)
  })

  it("libera (canDispatchNow=true, reason=null) quando cabe no teto restante", () => {
    const availability = resolveDispatchAvailability({
      status: "failed",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 100, limit: 2000, remaining: 1900 }),
      additionalRecipients: 500,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(true)
    expect(availability.reason).toBeNull()
  })

  it("nunca bloqueia por teto quando o time tem grant ilimitado, mesmo com additionalRecipients grande", () => {
    const availability = resolveDispatchAvailability({
      status: "draft",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ isUnlimited: true, limit: null, remaining: null, used: 50_000 }),
      additionalRecipients: 100_000,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(true)
    expect(availability.reason).toBeNull()
    expect(availability.isUnlimitedDailyCap).toBe(true)
  })

  it("status terminal sem motivo nomeado (canceled) fica indisponível com reason=null", () => {
    const availability = resolveDispatchAvailability({
      status: "canceled",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus(),
      additionalRecipients: 100,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.canDispatchNow).toBe(false)
    expect(availability.reason).toBeNull()
  })

  it("nextWindowAt é a meia-noite civil seguinte no fuso do time, não em UTC", () => {
    // 2026-09-10T14:00Z = 11:00 em America/Sao_Paulo (UTC-3) — meia-noite
    // seguinte local é 2026-09-11T00:00 America/Sao_Paulo = 2026-09-11T03:00Z.
    const availability = resolveDispatchAvailability({
      status: "scheduled",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 2000, remaining: 0 }),
      additionalRecipients: 100,
      now: NOW,
      timezone: TZ,
    })

    expect(availability.nextWindowAt).toBe("2026-09-11T03:00:00.000Z")
  })

  it("propaga queuedAheadCount quando informado, só quando o motivo é daily_cap_reached", () => {
    const capped = resolveDispatchAvailability({
      status: "scheduled",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 1998, remaining: 2 }),
      additionalRecipients: 2000,
      now: NOW,
      timezone: TZ,
      queuedAheadCount: 3,
    })
    expect(capped.queuedAheadCount).toBe(3)

    const notCapped = resolveDispatchAvailability({
      status: "scheduled",
      monthlyQuotaActive: false,
      dailyStatus: makeDailyStatus({ used: 0, remaining: 2000 }),
      additionalRecipients: 100,
      now: NOW,
      timezone: TZ,
      queuedAheadCount: 3,
    })
    expect(notCapped.queuedAheadCount).toBeNull()
  })
})
