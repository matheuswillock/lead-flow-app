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
 * Mesma consulta, restrita aos endereços perguntados.
 *
 * Existe porque o import passou a checar a blocklist LOTE A LOTE: com a versão
 * sem predicado, um arquivo de N lotes contra uma blocklist de M contatos
 * transferia O(N×M) linhas — dentro do worker que tem 45s de orçamento. Aqui o
 * custo por lote é proporcional ao lote, não ao tamanho da blocklist do time.
 *
 * O `IN` compara com as duas variantes (como veio e minúscula) porque
 * `EmailContact.email` não é normalizado na escrita.
 */
export async function findBlocklistedEmailsAmong(
  teamId: string,
  emails: string[]
): Promise<Set<string>> {
  if (emails.length === 0) return new Set()

  const candidates = [
    ...new Set(
      emails.flatMap((email) => {
        const trimmed = email.trim()
        return trimmed ? [trimmed, trimmed.toLowerCase()] : []
      })
    ),
  ]
  if (candidates.length === 0) return new Set()

  const contacts = await prisma.emailContact.findMany({
    where: {
      email: { in: candidates },
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

/**
 * Motivos de bloqueio persistidos em `EmailContact.blockReason`.
 *
 * Os textos são gravados no banco e replicados no backfill da migration
 * `20260824232131_email-contact-block-reason` — mudar um lado exige mudar o
 * outro, senão a base fica com duas grafias para o mesmo motivo.
 */
export const BLOCK_REASON_UNSUBSCRIBE = "Descadastro pelo destinatário"
export const BLOCK_REASON_BOUNCE = "Bounce reportado pelo provedor"
export const BLOCK_REASON_MANUAL = "Bloqueio manual"
export const BLOCK_REASON_IMPORT = "Importado na lista de bloqueados"

export type BlockTeamEmailParams = {
  teamId: string
  email: string
  name?: string | null
  createdBy: string
  /** Por que este endereço foi bloqueado — use uma das constantes BLOCK_REASON_*. */
  reason: string
  blockedAt?: Date
  /** Só o descadastro marca `isUnsubscribed`; bloqueio manual/import não é opt-out do destinatário. */
  markUnsubscribed?: boolean
}

/**
 * Bloqueio é por time: sai de todas as listas não arquivadas do time e entra na
 * blocklist com o motivo. Extraído de EmailUnsubscribeUseCase (scope "all"), que
 * é o comportamento que o descadastro já implementava — inclusão manual e import
 * na blocklist reusam a mesma rotina em vez de duplicá-la.
 */
export async function blockTeamEmail(
  tx: BlocklistWriter,
  params: BlockTeamEmailParams
): Promise<{ blocklistId: string }> {
  const normalizedEmail = params.email.trim().toLowerCase()
  const blockedAt = params.blockedAt ?? new Date()

  await removeEmailsFromTeamLists(tx, params.teamId, [normalizedEmail])
  const blocklistId = await ensureBlocklistId(tx, params.teamId, params.createdBy)

  await tx.emailContact.upsert({
    where: { listId_email: { listId: blocklistId, email: normalizedEmail } },
    update: {
      name: params.name ?? undefined,
      blockReason: params.reason,
      blockedAt,
      ...(params.markUnsubscribed ? { isUnsubscribed: true } : {}),
    },
    create: {
      id: randomUUID(),
      listId: blocklistId,
      email: normalizedEmail,
      name: params.name ?? null,
      blockReason: params.reason,
      blockedAt,
      isUnsubscribed: params.markUnsubscribed ?? false,
    },
  })

  await refreshListTotal(tx, blocklistId)
  return { blocklistId }
}

/**
 * Versão em lote, para import. Custo por lote é constante — não proporcional ao
 * número de endereços.
 *
 * Motivo: `blockTeamEmail` gasta ~9 queries e o worker de import chamava uma
 * transação por linha. Um lote de 500 virava 500 transações e ~4.500 round-trips
 * seriais, dentro de um cron com `maxDuration = 60` cujo guard de tempo só é
 * checado ENTRE lotes — o job morria no meio do lote, sem checkpoint, e
 * reiniciava do zero indefinidamente.
 */
export async function blockTeamEmailsBulk(
  tx: BlocklistWriter,
  params: {
    teamId: string
    createdBy: string
    contacts: Array<{ email: string; name?: string | null }>
    /** Por que o lote foi bloqueado — use uma das constantes BLOCK_REASON_*. */
    reason: string
    blockedAt?: Date
    markUnsubscribed?: boolean
  }
): Promise<{ blocklistId: string; blockedCount: number }> {
  const byEmail = new Map<string, { email: string; name?: string | null }>()
  for (const contact of params.contacts) {
    const normalizedEmail = contact.email.trim().toLowerCase()
    if (!normalizedEmail || byEmail.has(normalizedEmail)) continue
    byEmail.set(normalizedEmail, { email: normalizedEmail, name: contact.name ?? null })
  }

  const blocklistId = await ensureBlocklistId(tx, params.teamId, params.createdBy)
  if (byEmail.size === 0) return { blocklistId, blockedCount: 0 }

  const emails = [...byEmail.keys()]
  await removeEmailsFromTeamLists(tx, params.teamId, emails)

  // skipDuplicates: quem já estava bloqueado permanece, sem P2002 derrubar o lote.
  const created = await tx.emailContact.createMany({
    data: [...byEmail.values()].map((contact) => ({
      id: randomUUID(),
      listId: blocklistId,
      email: contact.email,
      name: contact.name ?? null,
      blockReason: params.reason,
      blockedAt: params.blockedAt ?? new Date(),
      isUnsubscribed: params.markUnsubscribed ?? false,
    })),
    skipDuplicates: true,
  })

  if (params.markUnsubscribed) {
    await tx.emailContact.updateMany({
      where: { listId: blocklistId, email: { in: emails } },
      data: { isUnsubscribed: true },
    })
  }

  await refreshListTotal(tx, blocklistId)
  // `created.count`, não `byEmail.size`: com `skipDuplicates`, quem já estava na
  // blocklist não gera linha nova. Devolver o total do input faria a importação
  // e a UI reportarem endereços preexistentes como recém-bloqueados, e inflaria
  // o `importedCount` a cada reprocessamento do mesmo lote.
  return { blocklistId, blockedCount: created.count }
}

/** Tira os endereços de todas as listas não arquivadas do time, menos a blocklist. */
async function removeEmailsFromTeamLists(
  tx: BlocklistWriter,
  teamId: string,
  normalizedEmails: string[]
): Promise<void> {
  if (normalizedEmails.length === 0) return

  const where = {
    email: { in: normalizedEmails },
    list: { teamId, isArchived: false, isBlocklist: false },
  }

  const affectedContacts = await tx.emailContact.findMany({
    where,
    select: { listId: true },
    distinct: ["listId"],
  })
  if (affectedContacts.length === 0) return

  await tx.emailContact.deleteMany({ where })

  // Uma atualização por LISTA afetada, não por endereço.
  for (const { listId } of affectedContacts) {
    await refreshListTotal(tx, listId)
  }
}

async function ensureBlocklistId(
  tx: BlocklistWriter,
  teamId: string,
  createdBy: string
): Promise<string> {
  const existing = await tx.emailContactList.findFirst({
    where: { teamId, isArchived: false, isBlocklist: true },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await tx.emailContactList.create({
    data: {
      id: randomUUID(),
      teamId,
      createdBy,
      name: EMAIL_BLOCKLIST_NAME,
      isBlocklist: true,
      isSystemDefault: false,
    },
    select: { id: true },
  })
  return created.id
}

async function refreshListTotal(tx: BlocklistWriter, listId: string): Promise<void> {
  const totalContacts = await tx.emailContact.count({ where: { listId } })
  await tx.emailContactList.update({ where: { id: listId }, data: { totalContacts } })
}
