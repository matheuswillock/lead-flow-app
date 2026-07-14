import { Prisma, type BackofficeLegalDocumentType, type BackofficeTermsAcceptanceOutboxStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

const documentSelect = { id: true, type: true, version: true, title: true, schemaVersion: true, content: true, contentHash: true, publishedAt: true } satisfies Prisma.BackofficeLegalDocumentSelect
const documentSetSelect = {
  id: true, version: true, schemaVersion: true, publishedAt: true,
  termsDocument: { select: documentSelect }, privacyDocument: { select: documentSelect }, contractDocument: { select: documentSelect },
} satisfies Prisma.BackofficeLegalDocumentSetSelect

export type AcceptanceDocumentRecord = Prisma.BackofficeLegalDocumentGetPayload<{ select: typeof documentSelect }>
export type AcceptanceDocumentSetRecord = Prisma.BackofficeLegalDocumentSetGetPayload<{ select: typeof documentSetSelect }>

export class BackofficeTermsAcceptanceRepository {
  issueToken(adhesionId: string, data: { hash: string; preview: string; issuedAt: Date; expiresAt: Date }) {
    return prisma.backofficeAdhesion.update({ where: { id: adhesionId }, data: { termsAcceptanceRequired: true, acceptanceTokenHash: data.hash, acceptanceTokenPreview: data.preview, acceptanceTokenIssuedAt: data.issuedAt, acceptanceTokenExpiresAt: data.expiresAt, acceptanceTokenAttempts: 0 } })
  }

  findAdhesionByTokenHash(hash: string) {
    return prisma.backofficeAdhesion.findUnique({
      where: { acceptanceTokenHash: hash },
      select: { id: true, fullName: true, email: true, phone: true, cpfCnpj: true, createdProfileId: true, acceptanceTokenAttempts: true, acceptanceTokenExpiresAt: true, termsAcceptance: { select: { id: true, protocol: true, acceptedAt: true } } },
    })
  }

  incrementTokenAttempts(adhesionId: string) {
    return prisma.backofficeAdhesion.update({ where: { id: adhesionId }, data: { acceptanceTokenAttempts: { increment: 1 } } })
  }

  findActiveDocumentSet(id?: string) {
    return prisma.backofficeLegalDocumentSet.findFirst({ where: { ...(id ? { id } : {}), isActive: true, publishedAt: { not: null } }, select: documentSetSelect, orderBy: { publishedAt: "desc" } })
  }

  async createAcceptance(input: {
    adhesionId: string; profileId: string | null; documentSetId: string; protocol: string; acceptedAt: Date; ipAddress: string | null; userAgent: string; locale: string | null;
    companyLegalName: string; companyTradeName: string | null; companyCnpj: string; representativeName: string; representativeCpf: string; representativeRole: string; representativeEmail: string; representativeWhatsapp: string;
    documents: AcceptanceDocumentRecord[];
  }) {
    return prisma.$transaction(async (tx) => {
      const acceptance = await tx.backofficeTermsAcceptance.create({
        data: {
          adhesionId: input.adhesionId, profileId: input.profileId, documentSetId: input.documentSetId, protocol: input.protocol, acceptedAt: input.acceptedAt, ipAddress: input.ipAddress, userAgent: input.userAgent, locale: input.locale,
          companyLegalName: input.companyLegalName, companyTradeName: input.companyTradeName, companyCnpj: input.companyCnpj, representativeName: input.representativeName, representativeCpf: input.representativeCpf, representativeRole: input.representativeRole, representativeEmail: input.representativeEmail, representativeWhatsapp: input.representativeWhatsapp,
          documents: { create: input.documents.map((document) => ({ legalDocument: { connect: { id: document.id } }, documentType: document.type, documentVersion: document.version, documentTitle: document.title, documentSchemaVersion: document.schemaVersion, documentContent: document.content as Prisma.InputJsonValue, documentContentHash: document.contentHash, documentPublishedAt: document.publishedAt! })) },
        },
        select: { id: true, protocol: true, acceptedAt: true },
      })
      await tx.backofficeTermsAcceptanceOutbox.createMany({ data: [
        { acceptanceId: acceptance.id, type: "generate_evidence", idempotencyKey: `${acceptance.id}:evidence` },
        { acceptanceId: acceptance.id, type: "send_confirmation_email", idempotencyKey: `${acceptance.id}:confirmation` },
        { acceptanceId: acceptance.id, type: "send_password_recovery", idempotencyKey: `${acceptance.id}:password-recovery` },
      ] })
      await tx.backofficeAdhesion.update({ where: { id: input.adhesionId }, data: { acceptanceTokenExpiresAt: input.acceptedAt } })
      return acceptance
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  findAcceptanceByAdhesion(adhesionId: string) { return prisma.backofficeTermsAcceptance.findUnique({ where: { adhesionId }, select: { id: true, protocol: true, acceptedAt: true } }) }
  findAcceptanceByProfile(profileId: string) { return prisma.backofficeTermsAcceptance.findFirst({ where: { profileId }, select: { id: true, protocol: true, acceptedAt: true, pdfStoragePath: true, pdfGeneratedAt: true, emailSentAt: true, documents: { select: { documentType: true, documentVersion: true, documentTitle: true, documentContentHash: true } }, outbox: { select: { type: true, status: true, lastError: true } } }, orderBy: { acceptedAt: "desc" } }) }
  markFirstPlatformAccess(profileId: string) { return prisma.backofficeAdhesion.updateMany({ where: { createdProfileId: profileId, firstPlatformAccessAt: null, termsAcceptance: { isNot: null } }, data: { firstPlatformAccessAt: new Date() } }) }
  findEvidencePath(profileId: string) { return prisma.backofficeTermsAcceptance.findFirst({ where: { profileId }, select: { pdfStoragePath: true }, orderBy: { acceptedAt: "desc" } }) }

  listLegalDocuments() { return prisma.backofficeLegalDocument.findMany({ orderBy: [{ type: "asc" }, { createdAt: "desc" }] }) }
  createLegalDocument(data: { type: BackofficeLegalDocumentType; version: string; title: string; schemaVersion: number; content: Prisma.InputJsonValue; contentHash: string; createdByBackofficeUserId: string | null }) { return prisma.backofficeLegalDocument.create({ data }) }
  async publishDocumentSet(input: { version: string; termsDocumentId: string; privacyDocumentId: string; contractDocumentId: string; actorBackofficeUserId: string | null }) {
    const ids = [input.termsDocumentId, input.privacyDocumentId, input.contractDocumentId]
    const documents = await prisma.backofficeLegalDocument.findMany({ where: { id: { in: ids } }, select: documentSelect })
    return { documents, publish: async (publishedAt: Date) => prisma.$transaction(async (tx) => {
      await tx.backofficeLegalDocumentSet.updateMany({ where: { isActive: true }, data: { isActive: false } })
      await tx.backofficeLegalDocument.updateMany({ where: { id: { in: ids }, publishedAt: null }, data: { publishedAt } })
      return tx.backofficeLegalDocumentSet.create({ data: { version: input.version, termsDocumentId: input.termsDocumentId, privacyDocumentId: input.privacyDocumentId, contractDocumentId: input.contractDocumentId, isActive: true, publishedAt, createdByBackofficeUserId: input.actorBackofficeUserId } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }) }
  }

  listOutboxCandidates(now: Date, lockBefore: Date, limit: number) { return prisma.backofficeTermsAcceptanceOutbox.findMany({ where: { nextAttemptAt: { lte: now }, OR: [{ status: "pending" }, { status: "processing", lockedAt: { lt: lockBefore } }] }, orderBy: { createdAt: "asc" }, take: limit }) }
  claimOutbox(id: string, now: Date, lockBefore: Date) { return prisma.backofficeTermsAcceptanceOutbox.updateMany({ where: { id, OR: [{ status: "pending" }, { status: "processing", lockedAt: { lt: lockBefore } }] }, data: { status: "processing", lockedAt: now, attempts: { increment: 1 } } }) }
  updateOutbox(id: string, data: { status: BackofficeTermsAcceptanceOutboxStatus; lockedAt: Date | null; completedAt?: Date; lastError: string | null; nextAttemptAt?: Date }) { return prisma.backofficeTermsAcceptanceOutbox.update({ where: { id }, data }) }
  findAcceptanceForPdf(id: string) { return prisma.backofficeTermsAcceptance.findUnique({ where: { id }, select: { id: true, protocol: true, acceptedAt: true, companyLegalName: true, companyCnpj: true, representativeName: true, representativeCpf: true, representativeRole: true, representativeEmail: true, ipAddress: true, userAgent: true, pdfStoragePath: true, documents: { select: { id: true, documentTitle: true, documentVersion: true, documentPublishedAt: true, documentContentHash: true, documentContent: true } } } }) }
  markPdfGenerated(id: string, data: { path: string; sha256: string; version: string; at: Date }) { return prisma.backofficeTermsAcceptance.update({ where: { id }, data: { pdfStoragePath: data.path, pdfSha256: data.sha256, pdfGeneratorVersion: data.version, pdfGeneratedAt: data.at } }) }
  findAcceptanceForConfirmation(id: string) { return prisma.backofficeTermsAcceptance.findUnique({ where: { id }, select: { id: true, protocol: true, representativeName: true, representativeEmail: true, pdfStoragePath: true, emailSentAt: true } }) }
  markEmailSent(id: string, at: Date) { return prisma.backofficeTermsAcceptance.update({ where: { id }, data: { emailSentAt: at } }) }
  findAcceptanceForPassword(id: string) { return prisma.backofficeTermsAcceptance.findUnique({ where: { id }, select: { adhesion: { select: { fullName: true, email: true } } } }) }
  findActivationPipeline(profileId: string) { return prisma.backofficeAdhesion.findFirst({ where: { createdProfileId: profileId }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, paidAt: true, firstPlatformAccessAt: true, termsAcceptance: { select: { protocol: true, acceptedAt: true, pdfStoragePath: true, outbox: { select: { status: true } } } } } }) }
  findAccessGate(profileId: string) { return prisma.backofficeAdhesion.findFirst({ where: { createdProfileId: profileId, status: "paid" }, select: { termsAcceptanceRequired: true, termsAcceptance: { select: { id: true } } }, orderBy: { paidAt: "desc" } }) }
  retryFailedOutbox(profileId: string) { return prisma.backofficeTermsAcceptanceOutbox.updateMany({ where: { acceptance: { profileId }, status: "failed" }, data: { status: "pending", nextAttemptAt: new Date(), lockedAt: null, lastError: null, maxAttempts: { increment: 3 } } }) }
}

export const backofficeTermsAcceptanceRepository = new BackofficeTermsAcceptanceRepository()
