import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeLeadOfferRecord,
  CreateBackofficeLeadOfferInput,
  IBackofficeLeadOfferRepository,
} from "./IBackofficeLeadOfferRepository"

export class BackofficeLeadOfferRepository implements IBackofficeLeadOfferRepository {
  async create(data: CreateBackofficeLeadOfferInput): Promise<BackofficeLeadOfferRecord> {
    return prisma.backofficeLeadOffer.create({
      data: {
        leadId: data.leadId,
        leadNameSnapshot: data.leadNameSnapshot,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        itemsJson: data.itemsJson,
        preContractExpiresAt: data.preContractExpiresAt,
        insuranceAmount: data.insuranceAmount,
        shareTokenHash: data.shareTokenHash,
        tokenPlain: data.tokenPlain,
        shareExpiresAt: data.shareExpiresAt,
        shareGeneratedByProfileId: data.shareGeneratedByProfileId,
      },
    })
  }

  async findById(id: string): Promise<BackofficeLeadOfferRecord | null> {
    return prisma.backofficeLeadOffer.findUnique({
      where: { id },
    })
  }

  async findByLeadId(leadId: string): Promise<BackofficeLeadOfferRecord[]> {
    return prisma.backofficeLeadOffer.findMany({
      where: { leadId },
      orderBy: { shareGeneratedAt: "desc" },
    })
  }

  async findByShareTokenHash(shareTokenHash: string): Promise<BackofficeLeadOfferRecord | null> {
    return prisma.backofficeLeadOffer.findUnique({
      where: { shareTokenHash },
    })
  }

  async revokeActiveByLeadId(leadId: string, revokedAt: Date): Promise<number> {
    const result = await prisma.backofficeLeadOffer.updateMany({
      where: {
        leadId,
        revokedAt: null,
        shareExpiresAt: { gt: revokedAt },
      },
      data: {
        revokedAt,
        shareExpiresAt: revokedAt,
        tokenPlain: null,
      },
    })
    return result.count
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await prisma.backofficeLeadOffer.update({
      where: { id },
      data: {
        revokedAt,
        shareExpiresAt: revokedAt,
        tokenPlain: null,
      },
    })
  }
}
