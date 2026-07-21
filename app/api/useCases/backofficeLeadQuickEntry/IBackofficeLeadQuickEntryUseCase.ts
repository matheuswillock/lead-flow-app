import { Output } from "@/lib/output"
import type { BackofficeLeadQuickEntryRequest } from "./DTO/requestBackofficeLeadQuickEntry"

export interface IBackofficeLeadQuickEntryUseCase {
  submit(data: BackofficeLeadQuickEntryRequest, createdByProfileId: string): Promise<Output>
}
