export type LegalDocumentBlock = { kind: "meta" | "heading" | "subheading" | "paragraph" | "listItem" | "romanItem"; text: string }
export type AcceptanceDocument = { id: string; type: "terms" | "privacy" | "contract"; version: string; title: string; schemaVersion: number; content: LegalDocumentBlock[]; contentHash: string; publishedAt: string }
export type AcceptancePageData = { adhesion: { fullName: string; email: string; phone: string; cpfCnpj: string | null }; documentSet: { id: string; version: string; schemaVersion: number; documents: AcceptanceDocument[] } }
export type AcceptanceResult = { acceptanceId: string; protocol: string; acceptedAt: string; alreadyAccepted: boolean; nextUrl: string }
export type AcceptanceForm = { companyLegalName: string; companyTradeName: string; companyCnpj: string; representativeName: string; representativeCpf: string; representativeRole: string; representativeEmail: string; representativeWhatsapp: string; declarationAccepted: boolean }
export type AcceptanceContextValue = {
  data: AcceptancePageData | null
  result: AcceptanceResult | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  load: () => Promise<void>
  submit: (form: AcceptanceForm) => Promise<void>
}

