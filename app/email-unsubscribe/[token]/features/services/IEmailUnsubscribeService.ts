import type { Output } from "@/lib/output"

export interface IEmailUnsubscribeService {
  getInfo(token: string): Promise<Output>
  unsubscribe(token: string): Promise<Output>
}
