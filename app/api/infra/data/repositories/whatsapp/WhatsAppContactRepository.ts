import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { resolveContactNameUpdate } from "@/lib/whatsapp/contact-name"
import type {
  CanonicalWhatsAppContact,
  IWhatsAppContactRepository,
  TeamWhatsAppContactSelect,
  UpsertWhatsAppContactInput,
} from "./IWhatsAppContactRepository"

const CANONICAL_CONTACT_SELECT = {
  id: true,
  teamId: true,
  phoneE164: true,
  name: true,
  nameSource: true,
  syncState: true,
  lastSyncedAt: true,
} as const

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
  async findOrCreateCanonical(input: {
    teamId: string
    phoneE164: string
    name?: string | null
    nameSource?: "MANUAL" | "LEAD" | "PHONE_BOOK" | "PUSH_NAME" | "PHONE_NUMBER"
  }): Promise<CanonicalWhatsAppContact> {
    const existing = await prisma.teamWhatsAppContact.findFirst({
      where: { teamId: input.teamId, phoneE164: input.phoneE164 },
      select: CANONICAL_CONTACT_SELECT,
    })
    if (existing) {
      const nameUpdate = resolveContactNameUpdate({
        currentName: existing.name,
        currentSource: existing.nameSource,
        incomingName: input.name,
        incomingSource: input.nameSource ?? "PHONE_NUMBER",
      })
      if (!nameUpdate) return existing
      return prisma.teamWhatsAppContact.update({
        where: { id: existing.id },
        data: {
          name: nameUpdate.contactName,
          displayName: nameUpdate.contactName,
          nameSource: nameUpdate.contactNameSource,
          searchText: `${nameUpdate.contactName} ${existing.phoneE164 ?? ""}`.trim().toLowerCase(),
          lastSeenAt: new Date(),
        },
        select: CANONICAL_CONTACT_SELECT,
      })
    }

    // Legacy columns remain non-null while old readers coexist. A deterministic
    // technical key is never returned through the API.
    const created = await prisma.teamWhatsAppContact.create({
      data: {
        teamId: input.teamId,
        remoteJid: `canonical:${input.phoneE164}`,
        opaqueId: input.phoneE164.replace(/\D/g, ""),
        phoneNumber: input.phoneE164.replace(/\D/g, ""),
        source: "PHONE_CONTACTS",
        phoneE164: input.phoneE164,
        name: input.name?.trim() || null,
        displayName: input.name?.trim() || null,
        nameSource: input.nameSource ?? "PHONE_NUMBER",
        searchText: `${input.name ?? ""} ${input.phoneE164}`.trim().toLowerCase(),
        syncState: "FRESH",
      },
      select: CANONICAL_CONTACT_SELECT,
    })
    return created
  }

  async findCanonicalById(teamId: string, contactId: string): Promise<CanonicalWhatsAppContact | null> {
    return prisma.teamWhatsAppContact.findFirst({
      where: { id: contactId, teamId },
      select: CANONICAL_CONTACT_SELECT,
    })
  }

  async findOrCreateProvisional(input: {
    teamId: string
    remoteJid: string
    displayName?: string | null
  }): Promise<CanonicalWhatsAppContact> {
    const existing = await prisma.teamWhatsAppContact.findUnique({
      where: { teamId_remoteJid: { teamId: input.teamId, remoteJid: input.remoteJid } },
      select: CANONICAL_CONTACT_SELECT,
    })
    if (existing) {
      return prisma.teamWhatsAppContact.update({
        where: { id: existing.id },
        data: { syncState: "UNRESOLVED", lastSeenAt: new Date() },
        select: CANONICAL_CONTACT_SELECT,
      })
    }
    return prisma.teamWhatsAppContact.create({
      data: {
        teamId: input.teamId,
        remoteJid: input.remoteJid,
        opaqueId: input.remoteJid.split("@")[0] ?? input.remoteJid,
        displayName: input.displayName?.trim() || null,
        pushName: input.displayName?.trim() || null,
        source: "PHONE_CONTACTS",
        name: input.displayName?.trim() || null,
        nameSource: input.displayName ? "PUSH_NAME" : "PHONE_NUMBER",
        searchText: (input.displayName ?? "").trim().toLowerCase(),
        syncState: "UNRESOLVED",
        lastSeenAt: new Date(),
      },
      select: CANONICAL_CONTACT_SELECT,
    })
  }

  async updateCanonical(input: {
    teamId: string
    contactId: string
    phoneE164?: string
    name?: string | null
  }): Promise<CanonicalWhatsAppContact> {
    const existing = await this.findCanonicalById(input.teamId, input.contactId)
    if (!existing) throw new Error("Contato não encontrado")
    const phoneE164 = input.phoneE164 ?? existing.phoneE164
    if (!phoneE164) throw new Error("Contato sem telefone não pode ser atualizado")
    const name = input.name === undefined ? existing.name : input.name?.trim() || null
    try {
      return await prisma.teamWhatsAppContact.update({
        where: { id: input.contactId },
        data: {
          phoneE164,
          phoneNumber: phoneE164.replace(/\D/g, ""),
          name,
          displayName: name,
          nameSource: "MANUAL",
          searchText: `${name ?? ""} ${phoneE164}`.trim().toLowerCase(),
          syncState: "FRESH",
        },
        select: CANONICAL_CONTACT_SELECT,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Já existe um contato deste time com este telefone")
      }
      throw error
    }
  }

  async searchCanonical(
    teamId: string,
    query: string,
    limit = 20,
    extraWhere?: Prisma.TeamWhatsAppContactWhereInput
  ): Promise<CanonicalWhatsAppContact[]> {
    const term = query.trim().toLowerCase()
    const digits = term.replace(/\D/g, "")
    const searchFilters: Prisma.TeamWhatsAppContactWhereInput[] = [
      { searchText: { contains: term, mode: "insensitive" } },
    ]
    if (digits) searchFilters.push({ phoneE164: { contains: digits } })
    return prisma.teamWhatsAppContact.findMany({
      where: {
        teamId,
        ...(extraWhere ? { AND: [extraWhere] } : {}),
        ...(term ? { OR: searchFilters } : {}),
      },
      select: CANONICAL_CONTACT_SELECT,
      orderBy: [{ name: "asc" }, { phoneE164: "asc" }],
      take: Math.min(limit, 50),
    })
  }

  async upsertIdentity(input: {
    teamId: string
    configId: string
    contactId: string
    remoteJid: string
    identityType: "PHONE" | "LID" | "GROUP" | "UNKNOWN"
    phoneE164?: string | null
    mappingSource: "CONTACT_SYNC" | "WEBHOOK" | "HISTORY" | "PROVIDER_MAPPING" | "MANUAL_LINK"
    verifiedAt?: Date | null
    sendable: boolean
  }): Promise<void> {
    await prisma.whatsAppContactIdentity.upsert({
      where: { teamId_configId_remoteJid: {
        teamId: input.teamId,
        configId: input.configId,
        remoteJid: input.remoteJid,
      } },
      create: {
        teamId: input.teamId,
        configId: input.configId,
        contactId: input.contactId,
        remoteJid: input.remoteJid,
        identityType: input.identityType,
        phoneE164: input.phoneE164 ?? null,
        mappingSource: input.mappingSource,
        verifiedAt: input.verifiedAt ?? null,
        sendable: input.sendable,
      },
      update: {
        contactId: input.contactId,
        identityType: input.identityType,
        phoneE164: input.phoneE164 ?? null,
        mappingSource: input.mappingSource,
        verifiedAt: input.verifiedAt ?? null,
        sendable: input.sendable,
        lastSeenAt: new Date(),
      },
    })
  }
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
    params?: {
      q?: string
      groupJid?: string
      limit?: number
      extraWhere?: Prisma.TeamWhatsAppContactWhereInput
    }
  ): Promise<TeamWhatsAppContactSelect[]> {
    const limit = Math.min(params?.limit ?? 500, 1000)
    const q = params?.q?.trim()

    if (q) {
      return this.search(teamId, q, params?.groupJid, limit, params?.extraWhere)
    }

    const where: Prisma.TeamWhatsAppContactWhereInput = {
      teamId,
      ...(params?.extraWhere ? { AND: [params.extraWhere] } : {}),
    }

    return prisma.teamWhatsAppContact.findMany({
      where,
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
    limit = 50,
    extraWhere?: Prisma.TeamWhatsAppContactWhereInput
  ): Promise<TeamWhatsAppContactSelect[]> {
    const term = q.trim()
    const baseTeamWhere: Prisma.TeamWhatsAppContactWhereInput = { teamId }

    if (!term) {
      const where: Prisma.TeamWhatsAppContactWhereInput = extraWhere
        ? { AND: [baseTeamWhere, extraWhere] }
        : baseTeamWhere
      return prisma.teamWhatsAppContact.findMany({
        where,
        select: CONTACT_SELECT,
        orderBy: [{ displayName: "asc" }, { pushName: "asc" }],
        take: limit,
      })
    }

    const searchWhere: Prisma.TeamWhatsAppContactWhereInput = {
      AND: [
        baseTeamWhere,
        ...(extraWhere ? [extraWhere] : []),
        {
          OR: [
            { displayName: { contains: term, mode: "insensitive" } },
            { pushName: { contains: term, mode: "insensitive" } },
            { phoneNumber: { contains: term } },
            { opaqueId: { contains: term } },
          ],
        },
      ],
    }

    return prisma.teamWhatsAppContact.findMany({
      where: searchWhere,
      select: CONTACT_SELECT,
      orderBy: [{ displayName: "asc" }, { pushName: "asc" }],
      take: limit,
    })
  }
}

export const whatsAppContactRepository = new WhatsAppContactRepository()
