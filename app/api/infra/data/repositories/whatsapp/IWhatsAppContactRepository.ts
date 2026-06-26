import type { TeamWhatsAppContactSource } from "@prisma/client"

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

export interface IWhatsAppContactRepository {
  upsertMany(contacts: UpsertWhatsAppContactInput[]): Promise<number>
  listByTeam(teamId: string, params?: { q?: string; groupJid?: string; limit?: number }): Promise<TeamWhatsAppContactSelect[]>
  findByOpaqueIds(teamId: string, opaqueIds: string[]): Promise<TeamWhatsAppContactSelect[]>
  search(teamId: string, q: string, groupJid?: string, limit?: number): Promise<TeamWhatsAppContactSelect[]>
}
