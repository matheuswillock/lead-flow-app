import { describe, expect, it } from "bun:test"
import { getCampaignSendBlockReason } from "./getCampaignSendBlockReason"
import type { CreditStatus, DispatchAvailability } from "../context/CampanhasTypes"
import { RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE } from "@/lib/email/campaign-dispatch-guards"

function makeAvailability(overrides: Partial<DispatchAvailability> = {}): DispatchAvailability {
  return {
    canDispatchNow: false,
    reason: "already_sent",
    dailyCap: 2000,
    sentToday: 0,
    isUnlimitedDailyCap: false,
    nextWindowAt: "2026-09-11T03:00:00.000Z",
    queuedAheadCount: null,
    ...overrides,
  }
}

function makeCredits(overrides: Partial<CreditStatus> = {}): CreditStatus {
  return {
    hasSubscription: true,
    isBetaExempt: false,
    plan: "starter",
    monthlyCredits: 1000,
    creditsUsed: 0,
    creditsAvailable: 1000,
    currentPeriodEnd: null,
    dailyDispatch: {
      limit: 2000,
      used: 1900,
      remaining: 100,
      isUnlimited: false,
    },
    ...overrides,
  }
}

describe("getCampaignSendBlockReason", () => {
  it("blocks beta-exempt teams when daily cap is insufficient", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 500 },
      credits: makeCredits({ isBetaExempt: true, hasSubscription: false }),
    })

    expect(reason).toContain("Restam 100")
  })

  it("skips subscription and credit checks when credits.isBetaExempt matches backend", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ isBetaExempt: true, hasSubscription: false, creditsAvailable: 0 }),
    })

    expect(reason).toBeUndefined()
  })

  it("skips subscription check when runtime bypassPlanGate is set", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ hasSubscription: false, isBetaExempt: false, creditsAvailable: 0 }),
      bypassPlanGate: true,
    })

    expect(reason).toBeUndefined()
  })

  it("does not treat display beta label alone — requires isBetaExempt or bypass", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        hasSubscription: false,
        isBetaExempt: false,
        creditsAvailable: 0,
        dailyDispatch: { limit: null, used: 0, remaining: null, isUnlimited: true },
      }),
    })

    expect(reason).toBe("Ative um plano em Assinaturas para disparar campanhas")
  })

  it("blocks without subscription when not beta-exempt and not bypassed", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        hasSubscription: false,
        isBetaExempt: false,
        creditsAvailable: 0,
        dailyDispatch: { limit: null, used: 0, remaining: null, isUnlimited: true },
      }),
      bypassPlanGate: false,
    })

    expect(reason).toBe("Ative um plano em Assinaturas para disparar campanhas")
  })

  it("blocks when custom-domain tracking is not ready", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        trackingDispatchBlocked: true,
        trackingDispatchBlockReason: RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE,
      }),
    })

    expect(reason).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
  })

  it("uses tracking required copy when blocked without a reason payload", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ trackingDispatchBlocked: true }),
    })

    expect(reason).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
  })

  describe("dispatchAvailability (T-M31.13/14 — botão com estado honesto)", () => {
    /**
     * Bug medido em produção (achado desta rodada): antes desta mudança, uma
     * parte `status: "sent"` só era barrada por crédito/plano/teto — nada
     * impedia clicar "Disparar" de novo e reenviar para TODA a audiência.
     * `dispatchAvailability.reason = "already_sent"` bloqueia mesmo com
     * créditos e teto liberados.
     */
    it("bloqueia parte já enviada mesmo com créditos e teto liberados (fecha o risco de re-disparo acidental)", () => {
      const reason = getCampaignSendBlockReason({
        campaign: {
          totalRecipients: 50,
          dispatchAvailability: makeAvailability({ reason: "already_sent" }),
        },
        credits: makeCredits({ dailyDispatch: { limit: 2000, used: 0, remaining: 2000, isUnlimited: false } }),
      })

      expect(reason).toBe(
        "Parte já enviada. Disparar de novo reenviaria a TODOS os destinatários novamente."
      )
    })

    it("bloqueia disparo em andamento", () => {
      const reason = getCampaignSendBlockReason({
        campaign: {
          totalRecipients: 50,
          dispatchAvailability: makeAvailability({ reason: "dispatch_in_progress" }),
        },
        credits: makeCredits(),
      })

      expect(reason).toBe("Disparo em andamento. Aguarde a conclusão para disparar de novo.")
    })

    /** Caso real (time Rafael, 09/09): 2.000/2.000 usados hoje. */
    it("explica o teto diário com o consumo exato — nunca promete a meia-noite sozinha", () => {
      const reason = getCampaignSendBlockReason({
        campaign: {
          totalRecipients: 2000,
          dispatchAvailability: makeAvailability({
            reason: "daily_cap_reached",
            dailyCap: 2000,
            sentToday: 2000,
          }),
        },
        credits: makeCredits(),
      })

      expect(reason).toContain("2.000/2.000 hoje")
      expect(reason).toContain("envios seguem a ordem de agendamento")
    })

    /**
     * Cenário de starvation em cascata (time Rafael, 10/09): o teto quase
     * esgotado (1.998/2.000) e há partes mais antigas na fila — a copy
     * declara a fila em vez de prometer "libera à meia-noite" sozinho.
     */
    it("inclui a posição na fila quando há partes mais antigas represadas (starvation em cascata)", () => {
      const reason = getCampaignSendBlockReason({
        campaign: {
          totalRecipients: 2000,
          dispatchAvailability: makeAvailability({
            reason: "daily_cap_reached",
            dailyCap: 2000,
            sentToday: 1998,
            queuedAheadCount: 2,
          }),
        },
        credits: makeCredits(),
      })

      expect(reason).toContain("1.998/2.000 hoje")
      expect(reason).toContain("Há 2 parte(s) agendada(s) antes desta")
    })

    it("bloqueia com a copy de cota mensal ativa", () => {
      const reason = getCampaignSendBlockReason({
        campaign: {
          totalRecipients: 50,
          dispatchAvailability: makeAvailability({ reason: "monthly_quota_active" }),
        },
        credits: makeCredits(),
      })

      expect(reason).toContain("Cota mensal de envio do provedor esgotada")
    })

    it("libera quando canDispatchNow=true, mesmo com dispatchAvailability presente", () => {
      const reason = getCampaignSendBlockReason({
        campaign: {
          totalRecipients: 50,
          dispatchAvailability: makeAvailability({ canDispatchNow: true, reason: null }),
        },
        credits: makeCredits(),
      })

      expect(reason).toBeUndefined()
    })

    it("sem dispatchAvailability (superfícies que ainda não o calculam), cai no gate legado de créditos", () => {
      const reason = getCampaignSendBlockReason({
        campaign: { totalRecipients: 50 },
        credits: makeCredits({
          dailyDispatch: { limit: 2000, used: 0, remaining: 2000, isUnlimited: false },
        }),
      })

      expect(reason).toBeUndefined()
    })
  })
})
