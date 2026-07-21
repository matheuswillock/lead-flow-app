import { Output } from "@/lib/output"

export interface IBackofficeEmailContactImportUseCase {
  processPendingJobs(): Promise<Output>
}
