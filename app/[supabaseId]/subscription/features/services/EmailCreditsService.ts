import { API_CLIENT_BASE } from "@/lib/route-map"
import type {
  EmailCreditsBillingType,
  EmailCreditsStatus,
  EmailCreditsStatusResult,
  EmailCreditsSubscribeResult,
  EmailCreditPlanId,
  IEmailCreditsService,
} from "./IEmailCreditsService"

class EmailCreditsServiceImpl implements IEmailCreditsService {
  async getStatus(): Promise<EmailCreditsStatusResult> {
    try {
      const res = await fetch(`${API_CLIENT_BASE}/email/credits/status`)
      if (!res.ok) return { ok: false }
      const json = await res.json()
      if (!json.isValid) return { ok: false }
      return { ok: true, status: json.result as EmailCreditsStatus }
    } catch (err) {
      console.error("[EmailCreditsService] getStatus network error", err)
      return { ok: false }
    }
  }

  async subscribe(
    plan: EmailCreditPlanId,
    billingType: EmailCreditsBillingType = "PIX"
  ): Promise<EmailCreditsSubscribeResult> {
    const res = await fetch(`${API_CLIENT_BASE}/email/credits/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, billingType }),
    })
    const json = await res.json()
    if (!json.isValid || !json.result?.checkoutUrl) {
      throw new Error(
        json.errorMessages?.join(", ") ?? "Erro ao criar checkout de créditos"
      )
    }
    return json.result as EmailCreditsSubscribeResult
  }

  async cancel(): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/email/credits/cancel`, {
      method: "POST",
    })
    const json = await res.json()
    if (!json.isValid) {
      throw new Error(json.errorMessages?.join(", ") ?? "Erro ao cancelar créditos")
    }
  }
}

export const emailCreditsService: IEmailCreditsService = new EmailCreditsServiceImpl()
