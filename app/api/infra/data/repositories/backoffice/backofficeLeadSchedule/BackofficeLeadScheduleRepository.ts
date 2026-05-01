import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeLeadScheduleForCalendar,
  CreateBackofficeLeadScheduleInput,
  IBackofficeLeadScheduleRepository,
  UpdateBackofficeLeadScheduleInput,
} from "./IBackofficeLeadScheduleRepository"

function toJsonValue(value: Prisma.InputJsonValue | null | undefined) {
  if (value === null) return Prisma.JsonNull
  return value ?? undefined
}

export class BackofficeLeadScheduleRepository
  implements IBackofficeLeadScheduleRepository
{
  async create(data: CreateBackofficeLeadScheduleInput) {
    return prisma.backofficeLeadSchedule.create({
      data: {
        id: data.id,
        leadId: data.leadId,
        closerBackofficeUserId: data.closerBackofficeUserId ?? null,
        date: data.date,
        meetingTitle: data.meetingTitle ?? null,
        notes: data.notes ?? null,
        meetingLink: data.meetingLink ?? null,
        extraGuests: data.extraGuests ?? [],
        googleEventId: data.googleEventId ?? null,
        googleCalendarId: data.googleCalendarId ?? null,
        inviteDispatchStatus: data.inviteDispatchStatus ?? null,
        inviteDispatchProvider: data.inviteDispatchProvider ?? null,
        inviteDispatchFallbackUsed: data.inviteDispatchFallbackUsed ?? false,
        inviteDispatchLastAttemptAt: data.inviteDispatchLastAttemptAt ?? null,
        inviteDispatchLastError: data.inviteDispatchLastError ?? null,
        inviteDispatchLastPayload: toJsonValue(data.inviteDispatchLastPayload),
        createdByProfileId: data.createdByProfileId ?? null,
      },
    })
  }

  async findByLeadId(leadId: string) {
    return prisma.backofficeLeadSchedule.findMany({
      where: { leadId },
      orderBy: { date: "desc" },
    })
  }

  async findLatestByLeadId(leadId: string) {
    return prisma.backofficeLeadSchedule.findFirst({
      where: { leadId },
      orderBy: { date: "desc" },
    })
  }

  async findLatestActiveByLeadId(leadId: string) {
    return prisma.backofficeLeadSchedule.findFirst({
      where: { leadId, isCanceled: false },
      orderBy: { date: "desc" },
    })
  }

  async findActiveForDay(params: {
    closerBackofficeUserIds: string[]
    dayStart: Date
    dayEnd: Date
  }): Promise<BackofficeLeadScheduleForCalendar[]> {
    return prisma.backofficeLeadSchedule.findMany({
      where: {
        isCanceled: false,
        closerBackofficeUserId: { in: params.closerBackofficeUserIds },
        date: {
          gte: params.dayStart,
          lt: params.dayEnd,
        },
      },
      select: {
        id: true,
        leadId: true,
        closerBackofficeUserId: true,
        date: true,
        meetingTitle: true,
        notes: true,
        meetingLink: true,
        extraGuests: true,
        googleEventId: true,
        googleCalendarId: true,
        inviteDispatchStatus: true,
        inviteDispatchProvider: true,
        isCanceled: true,
      },
      orderBy: { date: "asc" },
    })
  }

  async update(id: string, data: UpdateBackofficeLeadScheduleInput) {
    return prisma.backofficeLeadSchedule.update({
      where: { id },
      data: {
        ...(data.closerBackofficeUserId !== undefined
          ? { closerBackofficeUserId: data.closerBackofficeUserId }
          : {}),
        ...(data.date !== undefined ? { date: data.date } : {}),
        ...(data.meetingTitle !== undefined ? { meetingTitle: data.meetingTitle } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.meetingLink !== undefined ? { meetingLink: data.meetingLink } : {}),
        ...(data.extraGuests !== undefined ? { extraGuests: data.extraGuests } : {}),
        ...(data.googleEventId !== undefined ? { googleEventId: data.googleEventId } : {}),
        ...(data.googleCalendarId !== undefined
          ? { googleCalendarId: data.googleCalendarId }
          : {}),
        ...(data.inviteDispatchStatus !== undefined
          ? { inviteDispatchStatus: data.inviteDispatchStatus }
          : {}),
        ...(data.inviteDispatchProvider !== undefined
          ? { inviteDispatchProvider: data.inviteDispatchProvider }
          : {}),
        ...(data.inviteDispatchFallbackUsed !== undefined
          ? { inviteDispatchFallbackUsed: data.inviteDispatchFallbackUsed }
          : {}),
        ...(data.inviteDispatchLastAttemptAt !== undefined
          ? { inviteDispatchLastAttemptAt: data.inviteDispatchLastAttemptAt }
          : {}),
        ...(data.inviteDispatchLastError !== undefined
          ? { inviteDispatchLastError: data.inviteDispatchLastError }
          : {}),
        ...(data.inviteDispatchLastPayload !== undefined
          ? { inviteDispatchLastPayload: toJsonValue(data.inviteDispatchLastPayload) }
          : {}),
        ...(data.isCanceled !== undefined ? { isCanceled: data.isCanceled } : {}),
        ...(data.canceledAt !== undefined ? { canceledAt: data.canceledAt } : {}),
        ...(data.canceledByProfileId !== undefined
          ? { canceledByProfileId: data.canceledByProfileId }
          : {}),
        ...(data.cancelReason !== undefined ? { cancelReason: data.cancelReason } : {}),
      },
    })
  }

  async markCanceled(
    id: string,
    data: {
      canceledByProfileId?: string | null
      cancelReason?: string | null
    }
  ) {
    return prisma.backofficeLeadSchedule.update({
      where: { id },
      data: {
        isCanceled: true,
        canceledAt: new Date(),
        canceledByProfileId: data.canceledByProfileId ?? null,
        cancelReason: data.cancelReason ?? null,
      },
    })
  }
}

export const backofficeLeadScheduleRepository =
  new BackofficeLeadScheduleRepository()
