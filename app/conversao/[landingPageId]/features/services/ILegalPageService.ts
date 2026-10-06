import type { LegalDocumentKind, PublicLegalDocument } from "../context/LegalPageTypes"
export interface ILegalPageService { getPublic(landingPageId: string, kind: LegalDocumentKind): Promise<PublicLegalDocument | null> }
