import { randomBytes } from "node:crypto"
import { z } from "zod"
import { acceptanceTokenExpiry, acceptanceTokenPreview, generateAcceptanceToken, hashAcceptanceToken } from "@/lib/legal-documents/acceptance-token"
import { hashLegalDocument } from "@/lib/legal-documents/hash"
import { invalidateAccountAccessStatusCache } from "@/lib/cache/invalidation"
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage"
import { backofficeTermsAcceptanceRepository } from "@/app/api/infra/data/repositories/backoffice/termsAcceptance/BackofficeTermsAcceptanceRepository"
import type {
  AcceptanceDocumentDTO,
  AcceptancePageData,
  AcceptanceResult,
  IBackofficeTermsAcceptanceService,
  LegalDocumentBlock,
  SubmitAcceptanceInput,
} from "./IBackofficeTermsAcceptanceService"
import { AcceptanceServiceError } from "./IBackofficeTermsAcceptanceService"

const acceptanceFormSchema = z.object({
  companyLegalName: z.string().trim().min(2).max(180),
  companyTradeName: z.string().trim().max(180).nullish(),
  companyCnpj: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(14)),
  representativeName: z.string().trim().min(2).max(180),
  representativeCpf: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(11)),
  representativeRole: z.string().trim().min(2).max(100),
  representativeEmail: z.email(),
  representativeWhatsapp: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().min(10).max(11)),
  declarationAccepted: z.literal(true),
})
const legalDocumentSchema = z.object({
  type: z.enum(["terms", "privacy", "contract"]),
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2).max(180),
  schemaVersion: z.number().int().min(1).max(100).optional(),
  content: z.array(z.object({ kind: z.enum(["meta", "heading", "subheading", "paragraph", "listItem", "romanItem"]), text: z.string().trim().min(1).max(20_000) })).min(1).max(2_000),
})
const publishSetSchema = z.object({ version: z.string().trim().min(1).max(40), termsDocumentId: z.uuid(), privacyDocumentId: z.uuid(), contractDocumentId: z.uuid() })

function toDocumentDTO(document: {
  id: string
  type: AcceptanceDocumentDTO["type"]
  version: string
  title: string
  schemaVersion: number
  content: unknown
  contentHash: string
  publishedAt: Date | null
}): AcceptanceDocumentDTO {
  return {
    id: document.id,
    type: document.type,
    version: document.version,
    title: document.title,
    schemaVersion: document.schemaVersion,
    content: document.content as LegalDocumentBlock[],
    contentHash: document.contentHash,
    publishedAt: document.publishedAt?.toISOString() ?? "",
  }
}

function protocol(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)
  return `CS-${stamp}-${randomBytes(10).toString("hex").toUpperCase()}`
}

export class BackofficeTermsAcceptanceService implements IBackofficeTermsAcceptanceService {
  async createTokenForAdhesion(adhesionId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateAcceptanceToken()
    const expiresAt = acceptanceTokenExpiry()
    await backofficeTermsAcceptanceRepository.issueToken(adhesionId, { hash: hashAcceptanceToken(token), preview: acceptanceTokenPreview(token), issuedAt: new Date(), expiresAt })
    return { token, expiresAt }
  }

  private async findAdhesion(token: string) {
    if (!token || token.length < 32) throw new AcceptanceServiceError("Link de aceite inválido", "invalid_token")
    const adhesion = await backofficeTermsAcceptanceRepository.findAdhesionByTokenHash(hashAcceptanceToken(token))
    if (!adhesion) throw new AcceptanceServiceError("Link de aceite inválido", "invalid_token")
    return adhesion
  }

  private ensureFreshToken(adhesion: Awaited<ReturnType<BackofficeTermsAcceptanceService["findAdhesion"]>>) {
    if (adhesion.acceptanceTokenAttempts >= 10) {
      throw new AcceptanceServiceError("Limite de tentativas excedido. Solicite um novo link.", "too_many_attempts")
    }
    if (!adhesion.acceptanceTokenExpiresAt || adhesion.acceptanceTokenExpiresAt.getTime() <= Date.now()) {
      throw new AcceptanceServiceError("Este link de aceite expirou. Solicite um novo link.", "expired_token")
    }
  }

  async getPageDataByToken(token: string): Promise<AcceptancePageData> {
    const adhesion = await this.findAdhesion(token)
    if (adhesion.termsAcceptance) {
      throw new AcceptanceServiceError("Este aceite já foi concluído", "validation")
    }
    this.ensureFreshToken(adhesion)
    const documentSet = await backofficeTermsAcceptanceRepository.findActiveDocumentSet()
    if (!documentSet) {
      throw new AcceptanceServiceError("O conjunto documental ainda não foi publicado", "documents_unavailable")
    }
    const documents = [documentSet.termsDocument, documentSet.privacyDocument, documentSet.contractDocument]
    if (documents.some((document) => !document.publishedAt)) {
      throw new AcceptanceServiceError("O conjunto documental está incompleto", "documents_unavailable")
    }
    return {
      adhesion: {
        fullName: adhesion.fullName,
        email: adhesion.email ?? "",
        phone: adhesion.phone,
        cpfCnpj: adhesion.cpfCnpj,
      },
      documentSet: {
        id: documentSet.id,
        version: documentSet.version,
        schemaVersion: documentSet.schemaVersion,
        documents: documents.map(toDocumentDTO),
      },
    }
  }

  async submitAcceptance(token: string, input: SubmitAcceptanceInput): Promise<AcceptanceResult> {
    const adhesion = await this.findAdhesion(token)
    if (adhesion.termsAcceptance) {
      return {
        acceptanceId: adhesion.termsAcceptance.id,
        protocol: adhesion.termsAcceptance.protocol,
        acceptedAt: adhesion.termsAcceptance.acceptedAt.toISOString(),
        alreadyAccepted: true,
        nextUrl: "/sign-in",
      }
    }
    this.ensureFreshToken(adhesion)

    const parsed = acceptanceFormSchema.safeParse(input.form)
    if (!parsed.success) {
      await backofficeTermsAcceptanceRepository.incrementTokenAttempts(adhesion.id)
      throw new AcceptanceServiceError("Revise os dados obrigatórios do aceite", "validation")
    }

    const documentSet = await backofficeTermsAcceptanceRepository.findActiveDocumentSet(input.documentSetId)
    if (!documentSet) throw new AcceptanceServiceError("Os documentos foram atualizados. Recarregue a página.", "documents_changed")
    const documents = [documentSet.termsDocument, documentSet.privacyDocument, documentSet.contractDocument]
    const displayed = new Map(input.displayedDocuments.map((item) => [item.legalDocumentId, item.contentHash]))
    const bindingIsValid = documents.every((document) => {
      const recalculated = hashLegalDocument({
        type: document.type,
        version: document.version,
        title: document.title,
        schemaVersion: document.schemaVersion,
        content: document.content,
      })
      return Boolean(document.publishedAt) && displayed.get(document.id) === document.contentHash && recalculated === document.contentHash
    })
    if (!bindingIsValid || displayed.size !== 3) {
      throw new AcceptanceServiceError("Os documentos foram atualizados. Recarregue a página.", "documents_changed")
    }

    const acceptedAt = new Date()
    const { declarationAccepted: _declarationAccepted, ...acceptanceData } = parsed.data
    try {
      const acceptance = await backofficeTermsAcceptanceRepository.createAcceptance({ adhesionId: adhesion.id, profileId: adhesion.createdProfileId, documentSetId: documentSet.id, protocol: protocol(acceptedAt), acceptedAt, ipAddress: input.context.ipAddress, userAgent: input.context.userAgent.slice(0, 1000), locale: input.context.locale?.slice(0, 50) ?? null, ...acceptanceData, companyTradeName: parsed.data.companyTradeName || null, documents })
      if (adhesion.createdProfileId) invalidateAccountAccessStatusCache({ accountMasterId: adhesion.createdProfileId })
      return { acceptanceId: acceptance.id, protocol: acceptance.protocol, acceptedAt: acceptance.acceptedAt.toISOString(), alreadyAccepted: false, nextUrl: "/sign-in" }
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const winner = await backofficeTermsAcceptanceRepository.findAcceptanceByAdhesion(adhesion.id)
        if (winner) return { acceptanceId: winner.id, protocol: winner.protocol, acceptedAt: winner.acceptedAt.toISOString(), alreadyAccepted: true, nextUrl: "/sign-in" }
      }
      throw error
    }
  }

  async getAcceptanceByProfile(profileId: string): Promise<unknown> {
    return backofficeTermsAcceptanceRepository.findAcceptanceByProfile(profileId)
  }

  async getAcceptanceByAdhesion(adhesionId: string): Promise<unknown> {
    return backofficeTermsAcceptanceRepository.findAcceptanceByAdhesion(adhesionId)
  }

  async markFirstPlatformAccess(profileId: string): Promise<void> {
    await backofficeTermsAcceptanceRepository.markFirstPlatformAccess(profileId)
  }

  async getEvidenceDownload(profileId: string): Promise<{ signedUrl: string; expiresIn: number }> {
    const acceptance = await backofficeTermsAcceptanceRepository.findEvidencePath(profileId)
    if (!acceptance?.pdfStoragePath) throw new AcceptanceServiceError("Comprovante ainda não disponível", "not_found")
    const expiresIn = 5 * 60
    const result = await SupabaseStorageService.createSignedUrl(acceptance.pdfStoragePath, STORAGE_BUCKETS.TERMS_ACCEPTANCES, expiresIn)
    if (!result.success || !result.signedUrl) throw new AcceptanceServiceError("Não foi possível gerar o download", "not_found")
    return { signedUrl: result.signedUrl, expiresIn }
  }

  async listLegalDocuments(): Promise<unknown> {
    return backofficeTermsAcceptanceRepository.listLegalDocuments()
  }

  async createLegalDocument(input: { type: AcceptanceDocumentDTO["type"]; version: string; title: string; schemaVersion?: number; content: LegalDocumentBlock[]; actorBackofficeUserId?: string | null }): Promise<unknown> {
    const parsed = legalDocumentSchema.safeParse(input)
    if (!parsed.success) throw new AcceptanceServiceError("Versão, título e conteúdo válidos são obrigatórios", "validation")
    const schemaVersion = parsed.data.schemaVersion ?? 1
    return backofficeTermsAcceptanceRepository.createLegalDocument({
        type: parsed.data.type,
        version: parsed.data.version,
        title: parsed.data.title,
        schemaVersion,
        content: parsed.data.content,
        contentHash: hashLegalDocument({ type: parsed.data.type, version: parsed.data.version, title: parsed.data.title, schemaVersion, content: parsed.data.content }),
        createdByBackofficeUserId: input.actorBackofficeUserId ?? null,
    })
  }

  async publishDocumentSet(input: { version: string; termsDocumentId: string; privacyDocumentId: string; contractDocumentId: string; actorBackofficeUserId?: string | null }): Promise<unknown> {
    const parsed = publishSetSchema.safeParse(input)
    if (!parsed.success) throw new AcceptanceServiceError("Versão e documentos válidos são obrigatórios", "validation")
    const publication = await backofficeTermsAcceptanceRepository.publishDocumentSet({ ...parsed.data, actorBackofficeUserId: input.actorBackofficeUserId ?? null })
    const documents = publication.documents
    const byType = new Map(documents.map((document) => [document.type, document]))
    if (documents.length !== 3 || byType.get("terms")?.id !== parsed.data.termsDocumentId || byType.get("privacy")?.id !== parsed.data.privacyDocumentId || byType.get("contract")?.id !== parsed.data.contractDocumentId) {
      throw new AcceptanceServiceError("Selecione uma versão válida de cada documento", "validation")
    }
    for (const document of documents) {
      const expected = hashLegalDocument({ type: document.type, version: document.version, title: document.title, schemaVersion: document.schemaVersion, content: document.content })
      if (expected !== document.contentHash) throw new AcceptanceServiceError(`Hash inválido para ${document.title}`, "validation")
    }
    const publishedAt = new Date()
    return publication.publish(publishedAt)
  }

  async retryFailedProcessing(profileId: string): Promise<{ retried: number }> {
    const result = await backofficeTermsAcceptanceRepository.retryFailedOutbox(profileId)
    return { retried: result.count }
  }
}

export const backofficeTermsAcceptanceService = new BackofficeTermsAcceptanceService()
