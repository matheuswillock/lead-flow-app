import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailContactListService } from "@/app/api/services/EmailContactList/EmailContactListService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

export interface CreateContactListInput {
  name: string
  description?: string
}

const DEFAULT_LIST_NAME = "Todos contatos"

export class EmailContactListUseCase {
  private contactListService = new EmailContactListService()

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private async ensureDefaultList(ctx: TeamContext): Promise<{ id: string; isSystemDefault: boolean }> {
    const existingDefault = await prisma.emailContactList.findFirst({
      where: {
        teamId: ctx.teamId,
        isArchived: false,
        isSystemDefault: true,
      },
      select: { id: true, isSystemDefault: true },
    })

    if (existingDefault) {
      return existingDefault
    }

    return prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: ctx.teamId,
        createdBy: ctx.profileId,
        name: DEFAULT_LIST_NAME,
        isSystemDefault: true,
      },
      select: { id: true, isSystemDefault: true },
    })
  }

  async list(ctx: TeamContext): Promise<Output> {
    try {
      const defaultList = await this.ensureDefaultList(ctx)
      const lists = await prisma.emailContactList.findMany({
        where: { teamId: ctx.teamId, isArchived: false },
        select: {
          id: true,
          name: true,
          description: true,
          totalContacts: true,
          isSystemDefault: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
      })

      const teamContacts = await prisma.emailContact.findMany({
        where: { list: { teamId: ctx.teamId, isArchived: false } },
        select: { email: true },
      })

      const totalDefaultContacts = new Set(teamContacts.map((contact) => contact.email)).size

      const normalizedLists = lists
        .map((list) => {
          const isDefault = list.id === defaultList.id || list.isSystemDefault
          return {
            ...list,
            name: isDefault ? DEFAULT_LIST_NAME : list.name,
            description: isDefault ? list.description : list.description,
            totalContacts: isDefault ? totalDefaultContacts : list.totalContacts,
            isSystemDefault: isDefault,
          }
        })
        .sort((a, b) => Number(b.isSystemDefault) - Number(a.isSystemDefault))

      return new Output(true, [], [], normalizedLists)
    } catch (error) {
      console.error("[EmailContactListUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar listas de contatos"], null)
    }
  }

  async getById(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const list = await prisma.emailContactList.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: {
          id: true,
          name: true,
          description: true,
          totalContacts: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, fullName: true } },
          _count: {
            select: {
              contacts: { where: { isUnsubscribed: false, isBounced: false } },
            },
          },
        },
      })

      if (!list) {
        return new Output(false, [], ["Lista de contatos não encontrada"], null)
      }

      return new Output(true, [], [], list)
    } catch (error) {
      console.error("[EmailContactListUseCase][getById]", error)
      return new Output(false, [], ["Erro ao buscar lista de contatos"], null)
    }
  }

  async create(data: CreateContactListInput, ctx: TeamContext): Promise<Output> {
    try {
      if (!data.name?.trim()) {
        return new Output(false, [], ["Nome da lista é obrigatório"], null)
      }

      const list = await prisma.emailContactList.create({
        data: {
          id: randomUUID(),
          teamId: ctx.teamId,
          createdBy: ctx.profileId,
          name: data.name.trim(),
          description: data.description?.trim() ?? null,
          isSystemDefault: false,
        },
      })

      return new Output(true, ["Lista criada com sucesso"], [], list)
    } catch (error) {
      console.error("[EmailContactListUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar lista de contatos"], null)
    }
  }

  async update(id: string, data: Partial<CreateContactListInput>, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      if (existing.isSystemDefault) {
        return new Output(false, [], ["A lista padrão não pode ser alterada"], null)
      }

      const list = await prisma.emailContactList.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.description !== undefined && { description: data.description?.trim() ?? null }),
        },
      })

      return new Output(true, ["Lista atualizada com sucesso"], [], list)
    } catch (error) {
      console.error("[EmailContactListUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar lista de contatos"], null)
    }
  }

  async deleteList(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id, teamId: ctx.teamId },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      if (existing.isSystemDefault) {
        return new Output(false, [], ["A lista padrão não pode ser excluída"], null)
      }

      const campaignCount = await prisma.emailCampaign.count({
        where: { contactListId: id, teamId: ctx.teamId },
      })

      if (campaignCount > 0) {
        return new Output(false, [], ["Não é possível excluir uma lista vinculada a campanhas"], null)
      }

      await prisma.emailContactList.delete({ where: { id } })

      return new Output(true, ["Lista excluída com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailContactListUseCase][deleteList]", error)
      return new Output(false, [], ["Erro ao excluir lista de contatos"], null)
    }
  }

  async addContact(listId: string, email: string, name: string | null, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id: listId, teamId: ctx.teamId, isArchived: false },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      const normalizedEmail = this.normalizeEmail(email)
      const existingContact = await prisma.emailContact.findUnique({
        where: { listId_email: { listId, email: normalizedEmail } },
      })

      await prisma.emailContact.upsert({
        where: { listId_email: { listId, email: normalizedEmail } },
        update: { name: name ?? null },
        create: { id: randomUUID(), listId, email: normalizedEmail, name: name ?? null },
      })

      const defaultList = await this.ensureDefaultList(ctx)
      if (!existing.isSystemDefault) {
        await prisma.emailContact.upsert({
          where: { listId_email: { listId: defaultList.id, email: normalizedEmail } },
          update: { name: name ?? null },
          create: {
            id: randomUUID(),
            listId: defaultList.id,
            email: normalizedEmail,
            name: name ?? null,
          },
        })
      }

      if (!existingContact) {
        const totalCount = await prisma.emailContact.count({ where: { listId } })
        await prisma.emailContactList.update({
          where: { id: listId },
          data: { totalContacts: totalCount },
        })
      }
      if (!existing.isSystemDefault) {
        const defaultTotalCount = await prisma.emailContact.count({
          where: { listId: defaultList.id },
        })
        await prisma.emailContactList.update({
          where: { id: defaultList.id },
          data: { totalContacts: defaultTotalCount },
        })
      }

      const message = existingContact ? "Contato atualizado com sucesso" : "Contato adicionado com sucesso"
      return new Output(true, [message], [], null)
    } catch (error) {
      console.error("[EmailContactListUseCase][addContact]", error)
      return new Output(false, [], ["Erro ao adicionar contato"], null)
    }
  }

  async uploadCsv(id: string, csvContent: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      let contacts: ReturnType<EmailContactListService["parseCsv"]>
      try {
        contacts = this.contactListService.parseCsv(csvContent)
      } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : "Erro ao processar CSV"
        return new Output(false, [], [message], null)
      }

      if (contacts.length === 0) {
        return new Output(false, [], ["Nenhum contato válido encontrado no CSV"], null)
      }

      // Upsert contacts in batches of 500
      const BATCH_SIZE = 500
      let upsertedCount = 0

      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map((contact) =>
            prisma.emailContact.upsert({
              where: { listId_email: { listId: id, email: this.normalizeEmail(contact.email) } },
              update: {
                name: contact.name ?? null,
                customFields: (contact.customFields as object) ?? null,
              },
              create: {
                id: randomUUID(),
                listId: id,
                email: this.normalizeEmail(contact.email),
                name: contact.name ?? null,
                customFields: (contact.customFields as object) ?? null,
              },
            })
          )
        )
        upsertedCount += batch.length
      }

      // Update total contacts count
      const totalCount = await prisma.emailContact.count({ where: { listId: id } })
      await prisma.emailContactList.update({
        where: { id },
        data: { totalContacts: totalCount },
      })
      if (!existing.isSystemDefault) {
        const defaultList = await this.ensureDefaultList(ctx)
        for (const contact of contacts) {
          const normalizedEmail = this.normalizeEmail(contact.email)
          await prisma.emailContact.upsert({
            where: {
              listId_email: { listId: defaultList.id, email: normalizedEmail },
            },
            update: {
              name: contact.name ?? null,
              customFields: (contact.customFields as object) ?? null,
            },
            create: {
              id: randomUUID(),
              listId: defaultList.id,
              email: normalizedEmail,
              name: contact.name ?? null,
              customFields: (contact.customFields as object) ?? null,
            },
          })
        }
        const defaultTotalCount = await prisma.emailContact.count({
          where: { listId: defaultList.id },
        })
        await prisma.emailContactList.update({
          where: { id: defaultList.id },
          data: { totalContacts: defaultTotalCount },
        })
      }

      return new Output(
        true,
        [`${upsertedCount} contatos importados com sucesso`],
        [],
        { imported: upsertedCount, total: totalCount }
      )
    } catch (error) {
      console.error("[EmailContactListUseCase][uploadCsv]", error)
      return new Output(false, [], ["Erro ao importar contatos do CSV"], null)
    }
  }

  async listContacts(
    listId: string,
    ctx: TeamContext,
    options: { page: number; pageSize: number; search?: string }
  ): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id: listId, teamId: ctx.teamId, isArchived: false },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      const where = {
        listId,
        ...(options.search && {
          OR: [
            { email: { contains: options.search, mode: "insensitive" as const } },
            { name: { contains: options.search, mode: "insensitive" as const } },
          ],
        }),
      }

      const [contacts, total] = await prisma.$transaction([
        prisma.emailContact.findMany({
          where,
          skip: (options.page - 1) * options.pageSize,
          take: options.pageSize,
          orderBy: { createdAt: "desc" },
        }),
        prisma.emailContact.count({ where }),
      ])

      return new Output(true, [], [], {
        contacts,
        total,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(total / options.pageSize),
      })
    } catch (error) {
      console.error("[EmailContactListUseCase][listContacts]", error)
      return new Output(false, [], ["Erro ao listar contatos"], null)
    }
  }

  async deleteContact(listId: string, contactId: string, ctx: TeamContext): Promise<Output> {
    try {
      const list = await prisma.emailContactList.findFirst({
        where: { id: listId, teamId: ctx.teamId, isArchived: false },
      })

      if (!list) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      const contact = await prisma.emailContact.findFirst({
        where: { id: contactId, listId },
      })

      if (!contact) {
        return new Output(false, [], ["Contato não encontrado"], null)
      }

      if (list.isSystemDefault) {
        const affectedContacts = await prisma.emailContact.findMany({
          where: {
            email: contact.email,
            list: { teamId: ctx.teamId, isArchived: false },
          },
          select: { listId: true },
        })

        const affectedListIds = Array.from(new Set(affectedContacts.map((item) => item.listId)))

        await prisma.emailContact.deleteMany({
          where: {
            email: contact.email,
            list: { teamId: ctx.teamId, isArchived: false },
          },
        })

        for (const affectedListId of affectedListIds) {
          const totalCount = await prisma.emailContact.count({ where: { listId: affectedListId } })
          await prisma.emailContactList.update({
            where: { id: affectedListId },
            data: { totalContacts: totalCount },
          })
        }
        return new Output(true, ["Contato removido com sucesso"], [], null)
      }

      await prisma.$transaction([
        prisma.emailContact.delete({ where: { id: contactId } }),
      ])
      const totalCount = await prisma.emailContact.count({ where: { listId } })
      await prisma.emailContactList.update({
        where: { id: listId },
        data: { totalContacts: totalCount },
      })

      return new Output(true, ["Contato removido com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailContactListUseCase][deleteContact]", error)
      return new Output(false, [], ["Erro ao remover contato"], null)
    }
  }
}
