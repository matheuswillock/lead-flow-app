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
}

export const emailContactListRepository = new EmailContactListRepository()
