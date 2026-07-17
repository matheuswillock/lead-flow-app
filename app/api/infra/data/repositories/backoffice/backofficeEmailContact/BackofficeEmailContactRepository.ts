import type { Prisma, BackofficeEmailContact } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeEmailContactRepository,
  ListBackofficeEmailContactsParams,
  ListBackofficeEmailContactsResult,
  UpsertBackofficeEmailContactInput,
} from "./IBackofficeEmailContactRepository"

export class BackofficeEmailContactRepository implements IBackofficeEmailContactRepository {
  async upsertActive(data: UpsertBackofficeEmailContactInput): Promise<BackofficeEmailContact> {
    const normalizedEmail = data.email.trim().toLowerCase()
    return prisma.backofficeEmailContact.upsert({
      where: {
        listId_email: { listId: data.listId, email: normalizedEmail },
      },
      create: {
        listId: data.listId,
        email: normalizedEmail,
        name: data.name ?? null,
        customFields: (data.customFields ?? undefined) as Prisma.InputJsonValue | undefined,
        backofficeLeadId: data.backofficeLeadId ?? null,
      },
      update: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.backofficeLeadId !== undefined
          ? { backofficeLeadId: data.backofficeLeadId }
          : {}),
        isUnsubscribed: false,
      },
    })
  }

  async listByListId(
    listId: string,
    params: ListBackofficeEmailContactsParams
  ): Promise<ListBackofficeEmailContactsResult> {
    const skip = (params.page - 1) * params.pageSize
    const [contacts, total] = await prisma.$transaction([
      prisma.backofficeEmailContact.findMany({
        where: { listId },
        orderBy: { createdAt: "desc" },
        skip,
        take: params.pageSize,
      }),
      prisma.backofficeEmailContact.count({ where: { listId } }),
    ])
    return { contacts, total }
  }

  async listActiveByListId(listId: string): Promise<BackofficeEmailContact[]> {
    return prisma.backofficeEmailContact.findMany({
      where: { listId, isUnsubscribed: false, isBounced: false, isComplained: false },
    })
  }

  async findById(id: string): Promise<BackofficeEmailContact | null> {
    return prisma.backofficeEmailContact.findUnique({ where: { id } })
  }

  async markUnsubscribed(id: string): Promise<BackofficeEmailContact> {
    return prisma.backofficeEmailContact.update({
      where: { id },
      data: { isUnsubscribed: true },
    })
  }

  async markUnsubscribedByEmailInAllLists(email: string): Promise<number> {
    const result = await prisma.backofficeEmailContact.updateMany({
      where: { email: email.trim().toLowerCase() },
      data: { isUnsubscribed: true },
    })
    return result.count
  }

  async markBouncedByEmailInAllLists(email: string): Promise<number> {
    const result = await prisma.backofficeEmailContact.updateMany({
      where: { email: email.trim().toLowerCase() },
      data: { isBounced: true },
    })
    return result.count
  }

  async markComplainedByEmailInAllLists(email: string): Promise<number> {
    const result = await prisma.backofficeEmailContact.updateMany({
      where: { email: email.trim().toLowerCase() },
      data: { isComplained: true },
    })
    return result.count
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeEmailContact.delete({ where: { id } })
  }
}

export const backofficeEmailContactRepository = new BackofficeEmailContactRepository()
