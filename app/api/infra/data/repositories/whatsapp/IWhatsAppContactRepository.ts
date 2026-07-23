import type { TeamWhatsAppContactSource } from "@prisma/client"
import type { Prisma } from "@prisma/client"

export interface TeamWhatsAppContactSelect {
  id: string
  teamId: string
  remoteJid: string
  opaqueId: string
  phoneNumber: string | null
  displayName: string | null
  pushName: string | null
  source: TeamWhatsAppContactSource
  lastSyncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertWhatsAppContactInput {
  teamId: string
  remoteJid: string
  opaqueId: string
  phoneNumber?: string | null
  displayName?: string | null
  pushName?: string | null
  source: TeamWhatsAppContactSource
  lastSyncedAt?: Date
}

export interface CanonicalWhatsAppContact {
  id: string
  teamId: string
  phoneE164: string | null
  name: string | null
  nameSource: "MANUAL" | "LEAD" | "PHONE_BOOK" | "PUSH_NAME" | "PHONE_NUMBER"
  syncState: "FRESH" | "STALE" | "UNRESOLVED" | "CONFLICT"
  lastSyncedAt: Date
}

export interface IWhatsAppContactRepository {
  upsertMany(contacts: UpsertWhatsAppContactInput[]): Promise<number>
  listByTeam(
    teamId: string,
    params?: {
      q?: string
      groupJid?: string
      limit?: number
      extraWhere?: Prisma.TeamWhatsAppContactWhereInput
    }
  ): Promise<TeamWhatsAppContactSelect[]>
  findByOpaqueIds(teamId: string, opaqueIds: string[]): Promise<TeamWhatsAppContactSelect[]>
  search(
    teamId: string,
    q: string,
    groupJid?: string,
    limit?: number,
    extraWhere?: Prisma.TeamWhatsAppContactWhereInput
  ): Promise<TeamWhatsAppContactSelect[]>
  findOrCreateCanonical(input: {
    teamId: string
    phoneE164: string
    name?: string | null
    nameSource?: "MANUAL" | "LEAD" | "PHONE_BOOK" | "PUSH_NAME" | "PHONE_NUMBER"
  }): Promise<CanonicalWhatsAppContact>
  findOrCreateProvisional(input: {
    teamId: string
    remoteJid: string
    displayName?: string | null
  }): Promise<CanonicalWhatsAppContact>
  findCanonicalById(teamId: string, contactId: string): Promise<CanonicalWhatsAppContact | null>
  updateCanonical(input: {
    teamId: string
    contactId: string
    phoneE164?: string
    name?: string | null
  }): Promise<CanonicalWhatsAppContact>
  searchCanonical(
    teamId: string,
    query: string,
    limit?: number,
    extraWhere?: Prisma.TeamWhatsAppContactWhereInput
  ): Promise<CanonicalWhatsAppContact[]>
  upsertIdentity(input: {
    teamId: string
    configId: string
    contactId: string
    remoteJid: string
    identityType: "PHONE" | "LID" | "GROUP" | "UNKNOWN"
    phoneE164?: string | null
    mappingSource: "CONTACT_SYNC" | "WEBHOOK" | "HISTORY" | "PROVIDER_MAPPING" | "MANUAL_LINK"
    verifiedAt?: Date | null
    sendable: boolean
  }): Promise<void>
}
