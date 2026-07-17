import { randomUUID } from "crypto"
import { prisma } from "@/app/api/infra/data/prisma"

export const EMAIL_BLOCKLIST_NAME = "Bloqueados"

export async function ensureTeamEmailBlocklist(params: {
  teamId: string
  createdBy: string
}): Promise<{ id: string; isBlocklist: boolean }> {
  const existing = await prisma.emailContactList.findFirst({
    where: {
      teamId: params.teamId,
      isArchived: false,
      isBlocklist: true,
    },
    select: { id: true, isBlocklist: true },
  })

  if (existing) {
    return existing
  }

  return prisma.emailContactList.create({
    data: {
      id: randomUUID(),
      teamId: params.teamId,
      createdBy: params.createdBy,
      name: EMAIL_BLOCKLIST_NAME,
      isBlocklist: true,
      isSystemDefault: false,
    },
    select: { id: true, isBlocklist: true },
  })
}

export async function findTeamBlocklistedEmails(teamId: string): Promise<Set<string>> {
  const contacts = await prisma.emailContact.findMany({
    where: {
      list: {
        teamId,
        isArchived: false,
        isBlocklist: true,
      },
    },
    select: { email: true },
  })

  return new Set(contacts.map((contact) => contact.email.trim().toLowerCase()))
}
