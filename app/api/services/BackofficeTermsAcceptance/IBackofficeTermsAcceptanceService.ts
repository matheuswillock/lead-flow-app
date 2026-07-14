import type { BackofficeLegalDocumentType } from "@prisma/client"

export type LegalDocumentBlock = {
  kind: "meta" | "heading" | "subheading" | "paragraph" | "listItem" | "romanItem"
  text: string
}

export type AcceptanceDocumentDTO = {
  id: string
  type: BackofficeLegalDocumentType
  version: string
  title: string
  schemaVersion: number
  content: LegalDocumentBlock[]
  contentHash: string
  publishedAt: string
}

export type AcceptancePageData = {
  adhesion: {
    fullName: string
    email: string
    phone: string
    cpfCnpj: string | null
  }
  documentSet: {
    id: string
    version: string
    schemaVersion: number
    documents: AcceptanceDocumentDTO[]
  }
}

export type AcceptanceFormInput = {
  companyLegalName: string
  companyTradeName?: string | null
  companyCnpj: string
  representativeName: string
  representativeCpf: string
  representativeRole: string
  representativeEmail: string
  representativeWhatsapp: string
  declarationAccepted: boolean
}

export type SubmitAcceptanceInput = {
  form: AcceptanceFormInput
  documentSetId: string
  displayedDocuments: Array<{ legalDocumentId: string; contentHash: string }>
  context: { ipAddress: string | null; userAgent: string; locale: string | null }
}

export type AcceptanceResult = {
  acceptanceId: string
  protocol: string
  acceptedAt: string
  alreadyAccepted: boolean
  nextUrl: string
}

export interface IBackofficeTermsAcceptanceService {
  getPageDataByToken(token: string): Promise<AcceptancePageData>
  submitAcceptance(token: string, input: SubmitAcceptanceInput): Promise<AcceptanceResult>
  createTokenForAdhesion(adhesionId: string): Promise<{ token: string; expiresAt: Date }>
  getAcceptanceByProfile(profileId: string): Promise<unknown>
  getAcceptanceByAdhesion(adhesionId: string): Promise<unknown>
  markFirstPlatformAccess(profileId: string): Promise<void>
  getEvidenceDownload(profileId: string): Promise<{ signedUrl: string; expiresIn: number }>
  listLegalDocuments(): Promise<unknown>
  createLegalDocument(input: { type: BackofficeLegalDocumentType; version: string; title: string; schemaVersion?: number; content: LegalDocumentBlock[]; actorBackofficeUserId?: string | null }): Promise<unknown>
  publishDocumentSet(input: { version: string; termsDocumentId: string; privacyDocumentId: string; contractDocumentId: string; actorBackofficeUserId?: string | null }): Promise<unknown>
  retryFailedProcessing(profileId: string): Promise<{ retried: number }>
}

export class AcceptanceServiceError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_token" | "expired_token" | "too_many_attempts" | "documents_unavailable" | "documents_changed" | "validation" | "not_found"
  ) {
    super(message)
  }
}
