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
        shareTokenHash: data.shareTokenHash,
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

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await prisma.backofficeLeadOffer.update({
      where: { id },
      data: {
        revokedAt,
        shareExpiresAt: revokedAt,
      },
    })
  }
}
