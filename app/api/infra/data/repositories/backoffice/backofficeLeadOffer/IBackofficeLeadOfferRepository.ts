import type { Prisma } from "@prisma/client"

export type BackofficeLeadOfferItemSnapshot = {
  productId: string
  name: string
  description: string | null
  type: string
  priceMonthly: number | null
  priceQuarterly: number | null
  priceSemiannual: number | null
  priceAnnual: number | null
  priceLifetime: number | null
}

export type BackofficeLeadOfferRecord = {
  id: string
  leadId: string
  leadNameSnapshot: string
  contactName: string
  contactPhone: string
  itemsJson: Prisma.JsonValue
  shareTokenHash: string
  shareExpiresAt: Date
  shareGeneratedAt: Date
  shareGeneratedByProfileId: string | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CreateBackofficeLeadOfferInput = {
  leadId: string
  leadNameSnapshot: string
  contactName: string
  contactPhone: string
  itemsJson: BackofficeLeadOfferItemSnapshot[]
  shareTokenHash: string
  shareExpiresAt: Date
  shareGeneratedByProfileId: string
}

export interface IBackofficeLeadOfferRepository {
  create(data: CreateBackofficeLeadOfferInput): Promise<BackofficeLeadOfferRecord>
  findById(id: string): Promise<BackofficeLeadOfferRecord | null>
  findByLeadId(leadId: string): Promise<BackofficeLeadOfferRecord[]>
  findByShareTokenHash(shareTokenHash: string): Promise<BackofficeLeadOfferRecord | null>
  revoke(id: string, revokedAt: Date): Promise<void>
}
