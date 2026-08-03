import { randomUUID } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export class RadarMaterializeRepository {
  async createContactList(input: {
    teamId: string
    createdBy: string
    name: string
  }) {
    return prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: input.teamId,
        createdBy: input.createdBy,
        name: input.name,
        isSystemDefault: false,
        totalContacts: 0,
      },
      select: { id: true },
    })
  }

  async createContactsBatch(
    listId: string,
    rows: Array<{ email: string; name: string | null; customFields: Record<string, unknown> | null }>
  ) {
    if (rows.length === 0) return 0
    const result = await prisma.emailContact.createMany({
      data: rows.map((row) => ({
        id: randomUUID(),
        listId,
        email: row.email,
        name: row.name,
        customFields: row.customFields ? (row.customFields as Prisma.InputJsonValue) : undefined,
      })),
      skipDuplicates: true,
    })
    return result.count
  }

  async updateListTotalContacts(listId: string, totalContacts: number) {
    return prisma.emailContactList.update({
      where: { id: listId },
      data: { totalContacts },
    })
  }
}

export const radarMaterializeRepository = new RadarMaterializeRepository()
