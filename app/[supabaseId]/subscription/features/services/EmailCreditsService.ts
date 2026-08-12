import { API_CLIENT_BASE } from "@/lib/route-map"
import type {
  EmailCreditsBillingType,
  EmailCreditsStatus,
  EmailCreditsSubscribeResult,
  EmailCreditPlanId,
  IEmailCreditsService,
} from "./IEmailCreditsService"

class EmailCreditsServiceImpl implements IEmailCreditsService {
  async getStatus(): Promise<EmailCreditsStatus | null> {
    const res = await fetch(`${API_CLIENT_BASE}/email/credits/status`)
    if (!res.ok) return null
    const json = await res.json()
    if (!json.isValid) return null
    return json.result as EmailCreditsStatus
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
