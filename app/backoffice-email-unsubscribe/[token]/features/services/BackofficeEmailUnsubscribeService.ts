import { Output } from "@/lib/output"
import type { IBackofficeEmailUnsubscribeService } from "./IBackofficeEmailUnsubscribeService"

export class BackofficeEmailUnsubscribeService implements IBackofficeEmailUnsubscribeService {
  async getInfo(token: string): Promise<Output> {
    const response = await fetch(
      `/api/v1/backoffice/public/email-campaigns/unsubscribe/${encodeURIComponent(token)}`
    )
    return response.json()
  }

  async unsubscribe(token: string): Promise<Output> {
    const response = await fetch("/api/v1/backoffice/public/email-campaigns/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    return response.json()
  }
}

export const backofficeEmailUnsubscribeService = new BackofficeEmailUnsubscribeService()
