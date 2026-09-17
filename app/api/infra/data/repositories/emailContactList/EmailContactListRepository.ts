import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { findManyByInChunks } from "@/lib/prisma/chunked-in-query"

export type CreateContactListInput = {
  teamId: string
  createdBy: string
  name: string
}

export type ContactRow = {
  email: string
  name?: string | null
  isBounced?: boolean
}

export type QuarantinedListRow = {
  id: string
  name: string
  quarantineReason: string | null
}

export type ContactListQuarantineState = {
  id: string
  name: string
  isQuarantined: boolean
  quarantinedAt: Date | null
  quarantineReason: string | null
}

/**
 * Contrato mínimo consumido pelos casos de uso de quarentena (DIP) — o gate de
 * importação marca a lista, a liberação é explícita por manager/owner, e o
 * disparo de campanha consulta antes de montar audiência.
 */
export interface IEmailContactListQuarantineRepository {
  quarantineList(params: { listId: string; reason: string; now: Date }): Promise<void>
  releaseQuarantine(params: {
    listId: string
    teamId: string
    releasedBy: string
    now: Date
  }): Promise<{ released: boolean }>
  findQuarantinedLists(teamId: string, listIds: string[]): Promise<QuarantinedListRow[]>
  getQuarantineState(listId: string, teamId: string): Promise<ContactListQuarantineState | null>
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
    const existing = await findManyByInChunks(emails.filter(Boolean), (chunk) =>
      prisma.emailContact.findMany({
        where: { listId, email: { in: chunk } },
        select: { email: true },
      })
    )
    return new Set(existing.map((c) => c.email))
  }

  /**
   * Supressão por bounce é GLOBAL de propósito — não filtra por time.
   *
   * Um bounce permanente diz que a caixa não existe, o que independe de quem
   * envia. Compartilhar o sinal entre times evita que cada um redescubra o
   * mesmo endereço morto às custas da própria reputação de domínio.
   *
   * Contraste deliberado: reclamação (`isComplained`) é por time, porque
   * expressa a relação daquele destinatário com aquele remetente, não uma
   * propriedade do endereço. Ver `EmailLogRepository.applyWebhookEvent`.
   *
   * Não adicionar `teamId` sem decisão de produto: medido em 22/08/2026,
   * 11.535 contatos (16,7% dos marcados) dependem de evidência de outro time,
   * concentrados em 8 times. Escopar devolveria todos eles para envio.
   */
  async findBouncedEmails(emails: string[]): Promise<Set<string>> {
    const normalized = [
      ...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ]
    const bounced = await findManyByInChunks(normalized, (chunk) =>
      prisma.emailContact.findMany({
        where: { email: { in: chunk }, isBounced: true },
        select: { email: true },
        distinct: ["email"],
      })
    )
    return new Set(bounced.map((row) => row.email.trim().toLowerCase()))
  }

  async createContacts(listId: string, contacts: ContactRow[]): Promise<number> {
    if (contacts.length === 0) return 0
    const bouncedEmails = await this.findBouncedEmails(contacts.map((contact) => contact.email))
    const result = await prisma.emailContact.createMany({
      data: contacts.map((c) => ({
        id: randomUUID(),
        listId,
        email: c.email,
        name: c.name ?? null,
        customFields: Prisma.JsonNull,
        isBounced: c.isBounced === true || bouncedEmails.has(c.email.trim().toLowerCase()),
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

  /** Import de risco ALTO: a lista sai de circulação até liberação explícita. */
  async quarantineList(params: { listId: string; reason: string; now: Date }): Promise<void> {
    await prisma.emailContactList.update({
      where: { id: params.listId },
      data: {
        isQuarantined: true,
        quarantinedAt: params.now,
        quarantineReason: params.reason,
        quarantineReleasedAt: null,
        quarantineReleasedBy: null,
      },
    })
  }

  /**
   * `updateMany` com predicado completo: liberar lista de outro time ou lista
   * já liberada devolve `released: false` em vez de estourar.
   */
  async releaseQuarantine(params: {
    listId: string
    teamId: string
    releasedBy: string
    now: Date
  }): Promise<{ released: boolean }> {
    const result = await prisma.emailContactList.updateMany({
      where: { id: params.listId, teamId: params.teamId, isQuarantined: true },
      data: {
        isQuarantined: false,
        quarantineReleasedAt: params.now,
        quarantineReleasedBy: params.releasedBy,
      },
    })
    return { released: result.count === 1 }
  }

  async findQuarantinedLists(teamId: string, listIds: string[]): Promise<QuarantinedListRow[]> {
    const uniqueIds = [...new Set(listIds.filter(Boolean))]
    if (uniqueIds.length === 0) return []
    return prisma.emailContactList.findMany({
      where: { teamId, id: { in: uniqueIds }, isQuarantined: true },
      select: { id: true, name: true, quarantineReason: true },
    })
  }

  async getQuarantineState(
    listId: string,
    teamId: string
  ): Promise<ContactListQuarantineState | null> {
    return prisma.emailContactList.findFirst({
      where: { id: listId, teamId },
      select: {
        id: true,
        name: true,
        isQuarantined: true,
        quarantinedAt: true,
        quarantineReason: true,
      },
    })
  }
}

export const emailContactListRepository = new EmailContactListRepository()
