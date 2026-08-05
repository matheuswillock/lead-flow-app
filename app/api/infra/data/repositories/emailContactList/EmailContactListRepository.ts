import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type CreateContactListInput = {
  teamId: string
  createdBy: string
  name: string
}

export type ContactRow = {
  email: string
  name?: string | null
}

class EmailContactListRepository {
  async createList(input: CreateContactListInput): Promise<{ id: string }> {
    return prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: input.teamId,
        createdBy: input.createdBy,
        name: input.name,
        isSystemDefault: false,
      },
      select: { id: true },
    })
  }

  async findExistingEmailsInList(listId: string, emails: string[]): Promise<Set<string>> {
    const existing = await prisma.emailContact.findMany({
      where: { listId, email: { in: emails } },
      select: { email: true },
    })
    return new Set(existing.map((c) => c.email))
  }

  async createContacts(listId: string, contacts: ContactRow[]): Promise<number> {
    if (contacts.length === 0) return 0
    const result = await prisma.emailContact.createMany({
      data: contacts.map((c) => ({
        id: randomUUID(),
        listId,
        email: c.email,
        name: c.name ?? null,
        customFields: Prisma.JsonNull,
      })),
      skipDuplicates: true,
    })
    return result.count
  }

  async updateContactCount(listId: string, totalContacts: number): Promise<void> {
    await prisma.emailContactList.update({
      where: { id: listId },
      data: { totalContacts },
    })
  }
}

export const emailContactListRepository = new EmailContactListRepository()
