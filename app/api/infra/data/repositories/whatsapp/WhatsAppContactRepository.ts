import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IWhatsAppContactRepository,
  TeamWhatsAppContactSelect,
  UpsertWhatsAppContactInput,
} from "./IWhatsAppContactRepository"

const CONTACT_SELECT = {
  id: true,
  teamId: true,
  remoteJid: true,
  opaqueId: true,
  phoneNumber: true,
  displayName: true,
  pushName: true,
  source: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

class WhatsAppContactRepository implements IWhatsAppContactRepository {
  async upsertMany(contacts: UpsertWhatsAppContactInput[]): Promise<number> {
    if (contacts.length === 0) return 0

    const now = new Date()
    let count = 0

    for (const contact of contacts) {
      const syncedAt = contact.lastSyncedAt ?? now
      await prisma.teamWhatsAppContact.upsert({
        where: {
          teamId_remoteJid: {
            teamId: contact.teamId,
            remoteJid: contact.remoteJid,
          },
        },
        create: {
          teamId: contact.teamId,
          remoteJid: contact.remoteJid,
          opaqueId: contact.opaqueId,
          phoneNumber: contact.phoneNumber ?? null,
          displayName: contact.displayName ?? null,
          pushName: contact.pushName ?? null,
          source: contact.source,
          lastSyncedAt: syncedAt,
        },
        update: {
          opaqueId: contact.opaqueId,
          phoneNumber: contact.phoneNumber ?? undefined,
          displayName: contact.displayName ?? undefined,
          pushName: contact.pushName ?? undefined,
          source: contact.source,
          lastSyncedAt: syncedAt,
        },
      })
      count += 1
    }

    return count
  }

  async listByTeam(
    teamId: string,
    params?: { q?: string; groupJid?: string; limit?: number }
  ): Promise<TeamWhatsAppContactSelect[]> {
    const limit = Math.min(params?.limit ?? 500, 1000)
    const q = params?.q?.trim()

    if (q) {
      return this.search(teamId, q, params?.groupJid, limit)
    }

    return prisma.teamWhatsAppContact.findMany({
      where: { teamId },
      select: CONTACT_SELECT,
      orderBy: [{ displayName: "asc" }, { pushName: "asc" }],
      take: limit,
    })
  }

  async findByOpaqueIds(teamId: string, opaqueIds: string[]): Promise<TeamWhatsAppContactSelect[]> {
    if (opaqueIds.length === 0) return []

    return prisma.teamWhatsAppContact.findMany({
      where: {
        teamId,
        opaqueId: { in: opaqueIds },
      },
      select: CONTACT_SELECT,
    })
  }

  async search(
    teamId: string,
    q: string,
    _groupJid?: string,
    limit = 50
  ): Promise<TeamWhatsAppContactSelect[]> {
    const term = q.trim()
    if (!term) {
      return prisma.teamWhatsAppContact.findMany({
        where: { teamId },
        select: CONTACT_SELECT,
        orderBy: [{ displayName: "asc" }, { pushName: "asc" }],
        take: limit,
      })
    }

    return prisma.teamWhatsAppContact.findMany({
      where: {
        teamId,
        OR: [
          { displayName: { contains: term, mode: "insensitive" } },
          { pushName: { contains: term, mode: "insensitive" } },
          { phoneNumber: { contains: term } },
          { opaqueId: { contains: term } },
        ],
      },
      select: CONTACT_SELECT,
      orderBy: [{ displayName: "asc" }, { pushName: "asc" }],
      take: limit,
    })
  }
}

export const whatsAppContactRepository = new WhatsAppContactRepository()
