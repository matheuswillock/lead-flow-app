import { Output } from "@/lib/output"
import type { IBackofficeEmailUnsubscribeService } from "./IBackofficeEmailUnsubscribeService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeEmailUnsubscribeService implements IBackofficeEmailUnsubscribeService {
  async getInfo(token: string): Promise<Output> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/public/email-campaigns/unsubscribe/${encodeURIComponent(token)}`
    )
    return response.json()
  }

  async unsubscribe(token: string): Promise<Output> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/public/email-campaigns/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    return response.json()
  }
}

export const backofficeEmailUnsubscribeService = new BackofficeEmailUnsubscribeService()
