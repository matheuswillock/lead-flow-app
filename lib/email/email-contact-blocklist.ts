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

/**
 * Separa as duas metades em uma passada só. Quem só precisa descartar usa
 * `excludeBlocklistedEmails`; quem precisa reportar o motivo (import, inclusão
 * manual) usa `blocked` para montar o `skippedIssues`.
 */
export function partitionByBlocklist<T extends { email: string }>(
  rows: T[],
  blocklistedEmails: Set<string>
): { allowed: T[]; blocked: T[] } {
  if (blocklistedEmails.size === 0) return { allowed: rows, blocked: [] }

  const allowed: T[] = []
  const blocked: T[] = []
  for (const row of rows) {
    if (blocklistedEmails.has(row.email.trim().toLowerCase())) {
      blocked.push(row)
      continue
    }
    allowed.push(row)
  }
  return { allowed, blocked }
}

export function excludeBlocklistedEmails<T extends { email: string }>(
  recipients: T[],
  blocklistedEmails: Set<string>
): T[] {
  return partitionByBlocklist(recipients, blocklistedEmails).allowed
}
