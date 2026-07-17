import type { Output } from "@/lib/output"

export interface IBackofficeEmailUnsubscribeService {
  getInfo(token: string): Promise<Output>
  unsubscribe(token: string): Promise<Output>
}
