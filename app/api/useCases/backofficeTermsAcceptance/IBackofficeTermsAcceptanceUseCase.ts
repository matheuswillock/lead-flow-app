import type { Output } from "@/lib/output"
import type { SubmitAcceptanceInput } from "@/app/api/services/BackofficeTermsAcceptance/IBackofficeTermsAcceptanceService"
export type { SubmitAcceptanceInput } from "@/app/api/services/BackofficeTermsAcceptance/IBackofficeTermsAcceptanceService"

export interface IBackofficeTermsAcceptanceUseCase {
  getPageData(token: string): Promise<Output>
  submit(token: string, input: SubmitAcceptanceInput): Promise<Output>
  getByProfile(profileId: string): Promise<Output>
  markFirstAccess(profileId: string): Promise<Output>
  getEvidenceDownload(profileId: string): Promise<Output>
  listLegalDocuments(): Promise<Output>
  createLegalDocument(input: Parameters<import("@/app/api/services/BackofficeTermsAcceptance/IBackofficeTermsAcceptanceService").IBackofficeTermsAcceptanceService["createLegalDocument"]>[0]): Promise<Output>
  publishDocumentSet(input: Parameters<import("@/app/api/services/BackofficeTermsAcceptance/IBackofficeTermsAcceptanceService").IBackofficeTermsAcceptanceService["publishDocumentSet"]>[0]): Promise<Output>
  retryFailedProcessing(profileId: string): Promise<Output>
}
