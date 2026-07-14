import type { Output } from "@/lib/output"
export interface IBackofficeTermsAcceptanceOutboxUseCase { dispatchPending(limit?: number): Promise<Output> }
