import { Output } from "@/lib/output"
import type { EmailUnsubscribeScope } from "../context/EmailUnsubscribeTypes"
import type { IEmailUnsubscribeService } from "./IEmailUnsubscribeService"

export class EmailUnsubscribeService implements IEmailUnsubscribeService {
  async getInfo(token: string): Promise<Output> {
    const response = await fetch(`/api/v1/email/public/unsubscribe/${encodeURIComponent(token)}/info`)
    return response.json()
  }

  async unsubscribe(token: string, scope: EmailUnsubscribeScope): Promise<Output> {
    const response = await fetch("/api/v1/email/public/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, scope }),
    })
    return response.json()
  }
}

export const emailUnsubscribeService = new EmailUnsubscribeService()
