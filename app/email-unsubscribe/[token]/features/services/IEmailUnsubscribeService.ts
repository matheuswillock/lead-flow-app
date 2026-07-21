import type { Output } from "@/lib/output"
import type { EmailUnsubscribeScope } from "../context/EmailUnsubscribeTypes"

export interface IEmailUnsubscribeService {
  getInfo(token: string): Promise<Output>
  unsubscribe(token: string, scope: EmailUnsubscribeScope): Promise<Output>
}
