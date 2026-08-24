import { randomUUID } from "crypto"
import type { Prisma } from "@prisma/client"
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

/** Cliente Prisma ou cliente de transação — o bloqueio precisa rodar dentro da tx do chamador. */
type BlocklistWriter = Prisma.TransactionClient

export type BlockTeamEmailParams = {
  teamId: string
  email: string
  name?: string | null
  createdBy: string
  /** Só o descadastro marca `isUnsubscribed`; bloqueio manual/import não é opt-out do destinatário. */
  markUnsubscribed?: boolean
}

/**
 * Bloqueio é por time: sai de todas as listas não arquivadas do time e entra na
 * blocklist. Extraído de EmailUnsubscribeUseCase (scope "all"), que é o
 * comportamento que o descadastro já implementava — inclusão manual e import na
 * blocklist agora reusam a mesma rotina em vez de duplicá-la.
 *
 * O motivo do bloqueio (`blockReason`/`blockedAt`) ainda NÃO é persistido: as
 * colunas dependem de uma migration que só pode ser gerada depois que o drift
 * entre `prisma/schema.prisma` e `supabase/migrations/**` for fechado. Até lá a
 * origem é inferida na leitura, como a UI da blocklist já faz hoje via
 * `resolve-contact-unsubscribe-source`.
 */
export async function blockTeamEmail(
  tx: BlocklistWriter,
  params: BlockTeamEmailParams
): Promise<{ blocklistId: string }> {
  const normalizedEmail = params.email.trim().toLowerCase()

  const affectedContacts = await tx.emailContact.findMany({
    where: {
      email: normalizedEmail,
      list: { teamId: params.teamId, isArchived: false, isBlocklist: false },
    },
    select: { listId: true },
  })
  const affectedListIds = Array.from(new Set(affectedContacts.map((item) => item.listId)))

  await tx.emailContact.deleteMany({
    where: {
      email: normalizedEmail,
      list: { teamId: params.teamId, isArchived: false, isBlocklist: false },
    },
  })

  for (const listId of affectedListIds) {
    const totalCount = await tx.emailContact.count({ where: { listId } })
    await tx.emailContactList.update({
      where: { id: listId },
      data: { totalContacts: totalCount },
    })
  }

  let blocklist = await tx.emailContactList.findFirst({
    where: { teamId: params.teamId, isArchived: false, isBlocklist: true },
    select: { id: true },
  })

  if (!blocklist) {
    blocklist = await tx.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: params.teamId,
        createdBy: params.createdBy,
        name: EMAIL_BLOCKLIST_NAME,
        isBlocklist: true,
        isSystemDefault: false,
      },
      select: { id: true },
    })
  }

  await tx.emailContact.upsert({
    where: { listId_email: { listId: blocklist.id, email: normalizedEmail } },
    update: {
      name: params.name ?? undefined,
      ...(params.markUnsubscribed ? { isUnsubscribed: true } : {}),
    },
    create: {
      id: randomUUID(),
      listId: blocklist.id,
      email: normalizedEmail,
      name: params.name ?? null,
      isUnsubscribed: params.markUnsubscribed ?? false,
    },
  })

  const blocklistTotal = await tx.emailContact.count({ where: { listId: blocklist.id } })
  await tx.emailContactList.update({
    where: { id: blocklist.id },
    data: { totalContacts: blocklistTotal },
  })

  return { blocklistId: blocklist.id }
}
