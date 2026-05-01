import {
  BackofficeLeadOrigin,
  type Prisma,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeLeadInput,
  BackofficeLeadWithRelations,
  IBackofficeLeadRepository,
  ListBackofficeLeadsParams,
  UpdateBackofficeLeadInput,
  UpdateBackofficeLeadStatusInput,
} from "./IBackofficeLeadRepository"

const backofficeLeadUserSelect = {
  id: true,
  email: true,
  isActive: true,
  isSdr: true,
  isCloser: true,
  profile: {
    select: {
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.BackofficeUserSelect

const backofficeLeadInclude = {
  sdrBackofficeUser: {
    select: backofficeLeadUserSelect,
  },
  closerBackofficeUser: {
    select: backofficeLeadUserSelect,
  },
  adhesion: {
    select: {
      id: true,
      status: true,
      expiresAt: true,
      paidAt: true,
    },
  },
} satisfies Prisma.BackofficeLeadInclude

export class BackofficeLeadRepository implements IBackofficeLeadRepository {
  async create(data: CreateBackofficeLeadInput): Promise<BackofficeLeadWithRelations> {
    return prisma.backofficeLead.create({
      data: {
        id: data.id,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        cnpj: data.cnpj ?? null,
        notes: data.notes ?? null,
        status: data.status,
        origin: data.origin ?? BackofficeLeadOrigin.manual,
        sourceExternalId: data.sourceExternalId ?? null,
        sourceWebhookEventId: data.sourceWebhookEventId ?? null,
        sdrBackofficeUserId: data.sdrBackofficeUserId ?? null,
        closerBackofficeUserId: data.closerBackofficeUserId ?? null,
        meetingDate: data.meetingDate ?? null,
        meetingTitle: data.meetingTitle ?? null,
        meetingNotes: data.meetingNotes ?? null,
        meetingLink: data.meetingLink ?? null,
        meetingExtraGuests: data.meetingExtraGuests ?? [],
        createdByProfileId: data.createdByProfileId ?? null,
      },
      include: backofficeLeadInclude,
    })
  }

  async findMany(params?: ListBackofficeLeadsParams): Promise<BackofficeLeadWithRelations[]> {
    return prisma.backofficeLead.findMany({
      where: params?.status ? { status: params.status } : undefined,
      include: backofficeLeadInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficeLeadWithRelations | null> {
    return prisma.backofficeLead.findUnique({
      where: { id },
      include: backofficeLeadInclude,
    })
  }

  async findBySourceExternalId(
    sourceExternalId: string
  ): Promise<BackofficeLeadWithRelations | null> {
    return prisma.backofficeLead.findUnique({
      where: { sourceExternalId },
      include: backofficeLeadInclude,
    })
  }

  async update(
    id: string,
    data: UpdateBackofficeLeadInput
  ): Promise<BackofficeLeadWithRelations> {
    return prisma.backofficeLead.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.cnpj !== undefined ? { cnpj: data.cnpj } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.sdrBackofficeUserId !== undefined
          ? { sdrBackofficeUserId: data.sdrBackofficeUserId }
          : {}),
        ...(data.closerBackofficeUserId !== undefined
          ? { closerBackofficeUserId: data.closerBackofficeUserId }
          : {}),
        ...(data.meetingDate !== undefined ? { meetingDate: data.meetingDate } : {}),
        ...(data.meetingTitle !== undefined ? { meetingTitle: data.meetingTitle } : {}),
        ...(data.meetingNotes !== undefined ? { meetingNotes: data.meetingNotes } : {}),
        ...(data.meetingLink !== undefined ? { meetingLink: data.meetingLink } : {}),
        ...(data.meetingExtraGuests !== undefined
          ? { meetingExtraGuests: data.meetingExtraGuests }
          : {}),
      },
      include: backofficeLeadInclude,
    })
  }

  async updateStatus(
    id: string,
    data: UpdateBackofficeLeadStatusInput
  ): Promise<BackofficeLeadWithRelations> {
    return prisma.backofficeLead.update({
      where: { id },
      data: {
        status: data.status,
        statusEnteredAt: new Date(),
        ...(data.closerBackofficeUserId !== undefined
          ? { closerBackofficeUserId: data.closerBackofficeUserId }
          : {}),
        ...(data.meetingDate !== undefined ? { meetingDate: data.meetingDate } : {}),
        ...(data.meetingTitle !== undefined ? { meetingTitle: data.meetingTitle } : {}),
        ...(data.meetingNotes !== undefined ? { meetingNotes: data.meetingNotes } : {}),
        ...(data.meetingLink !== undefined ? { meetingLink: data.meetingLink } : {}),
        ...(data.meetingExtraGuests !== undefined
          ? { meetingExtraGuests: data.meetingExtraGuests }
          : {}),
      },
      include: backofficeLeadInclude,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeLead.delete({ where: { id } })
  }
}
