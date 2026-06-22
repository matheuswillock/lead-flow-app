import { prisma } from "@/app/api/infra/data/prisma"
import type {
  ApplyBackofficeEmailDispatchWebhookRepositoryInput,
  CreateBackofficeEmailDispatchRepositoryInput,
  IBackofficeEmailDispatchRepository,
  RecordGoogleDispatchRepositoryInput,
} from "./IBackofficeEmailDispatchRepository"

export class BackofficeEmailDispatchRepository implements IBackofficeEmailDispatchRepository {
  async findProfileRecipientEmails(profileId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        email: true,
        googleConnection: { select: { googleEmail: true } },
      },
    })

    if (!profile?.email) return null

    return {
      email: profile.email,
      googleEmail: profile.googleConnection?.googleEmail ?? null,
    }
  }

  async findProfilesByRecipientEmails(emails: string[]) {
    const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
    if (normalized.length === 0) return []

    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { email: { in: normalized, mode: "insensitive" } },
          { googleConnection: { googleEmail: { in: normalized, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        email: true,
        googleConnection: { select: { googleEmail: true } },
      },
    })

    return profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      googleEmail: profile.googleConnection?.googleEmail ?? null,
    }))
  }

  async createQueuedDispatch(input: CreateBackofficeEmailDispatchRepositoryInput): Promise<string> {
    const dispatch = await prisma.backofficeEmailDispatch.create({
      data: {
        id: input.id,
        profileId: input.profileId,
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        recipientKind: input.recipientKind,
        provider: input.provider,
        category: input.category,
        subject: input.subject,
        status: "queued",
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      },
      select: { id: true },
    })

    return dispatch.id
  }

  async markSent(id: string, resendEmailId: string, sentAt: Date): Promise<void> {
    await prisma.backofficeEmailDispatch.update({
      where: { id },
      data: {
        status: "sent",
        resendEmailId,
        sentAt,
        errorMessage: null,
      },
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await prisma.backofficeEmailDispatch.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
      },
    })
  }

  async recordGoogleDispatch(input: RecordGoogleDispatchRepositoryInput): Promise<string> {
    const dispatch = await prisma.backofficeEmailDispatch.create({
      data: {
        id: input.id,
        profileId: input.profileId,
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        recipientKind: input.recipientKind,
        provider: "google_calendar",
        category: input.category,
        subject: input.subject,
        status: input.success ? "sent" : "failed",
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        errorMessage: input.success ? null : input.errorMessage ?? "Falha no envio via Google Calendar",
        sentAt: input.sentAt,
      },
      select: { id: true },
    })

    return dispatch.id
  }

  async findByResendEmailId(resendEmailId: string) {
    return prisma.backofficeEmailDispatch.findUnique({
      where: { resendEmailId },
    })
  }

  async applyWebhookEvent(input: ApplyBackofficeEmailDispatchWebhookRepositoryInput): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.backofficeEmailDispatchEvent.findFirst({
        where: {
          dispatchId: input.dispatchId,
          type: input.eventType,
          occurredAt: input.occurredAt,
        },
        select: { id: true },
      })

      if (duplicate) {
        return
      }

      await tx.backofficeEmailDispatchEvent.create({
        data: {
          id: input.eventId,
          dispatchId: input.dispatchId,
          type: input.eventType,
          occurredAt: input.occurredAt,
          metadata: input.metadata,
        },
      })

      await tx.backofficeEmailDispatch.update({
        where: { id: input.dispatchId },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...input.timestampUpdate,
        },
      })
    })
  }
}

export const backofficeEmailDispatchRepository = new BackofficeEmailDispatchRepository()
