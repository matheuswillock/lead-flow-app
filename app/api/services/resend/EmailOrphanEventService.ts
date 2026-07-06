import { prisma } from "@/app/api/infra/data/prisma"
import { parseResendTrackingTags, type ResendTrackingTagsInput } from "@/lib/email/build-resend-tracking-tags"
import { isBackofficeResendTags } from "@/lib/email/build-backoffice-resend-tags"
import {
  resendEmailEnrichmentService,
  type IResendEmailEnrichmentService,
} from "@/app/api/services/resend/ResendEmailEnrichmentService"

const BATCH_SIZE = 10
const MAX_REQUESTS_PER_SECOND = 8
const MIN_INTERVAL_MS = Math.ceil(1000 / MAX_REQUESTS_PER_SECOND)
const MAX_ATTEMPTS = 5

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes("rate_limit") || normalized.includes("429")
}

export class EmailOrphanEventService {
  constructor(
    private readonly enrichmentService: IResendEmailEnrichmentService = resendEmailEnrichmentService
  ) {}

  async queueOrphanEvent(input: {
    resendEmailId: string
    resendEventType: string
    occurredAt: Date
    tagsHint?: ResendTrackingTagsInput
  }): Promise<void> {
    if (isBackofficeResendTags(input.tagsHint ?? null)) {
      return
    }

    const parsed = parseResendTrackingTags(input.tagsHint)
    if (!parsed.teamId) {
      return
    }

    await prisma.emailOrphanEvent.upsert({
      where: { resendEmailId: input.resendEmailId },
      create: {
        resendEmailId: input.resendEmailId,
        resendEventType: input.resendEventType,
        occurredAt: input.occurredAt,
        tagsHint: input.tagsHint ?? undefined,
        status: "pending",
      },
      update: {},
    })
  }

  async processPendingBatch(): Promise<{ processed: number; failed: number; skipped: number }> {
    const pending = await prisma.emailOrphanEvent.findMany({
      where: { status: "pending", attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    })

    let processed = 0
    let failed = 0
    let skipped = 0

    for (const event of pending) {
      let backoffMs = MIN_INTERVAL_MS
      let success = false
      let lastError: string | null = null
      let rateLimited = false

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const logId = await this.enrichmentService.createOrphanTeamEmailLogFromResendEmail(
            event.resendEmailId,
            event.occurredAt,
            event.tagsHint as ResendTrackingTagsInput
          )

          if (logId) {
            success = true
            break
          }

          lastError = "Não foi possível criar EmailLog órfão"
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Erro ao processar órfão"
          rateLimited = isRateLimitError(lastError)
          if (rateLimited) break
        }

        if (attempt < 2) {
          await sleep(backoffMs)
          backoffMs *= 2
        }
      }

      if (success) {
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: {
            status: "processed",
            processedAt: new Date(),
            attempts: { increment: 1 },
          },
        })
        processed += 1
      } else if (rateLimited || isRateLimitError(lastError)) {
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            lastError,
          },
        })
        failed += 1
        await sleep(backoffMs)
      } else {
        const nextAttempts = event.attempts + 1
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: {
            status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts: { increment: 1 },
            lastError,
          },
        })
        if (nextAttempts >= MAX_ATTEMPTS) {
          failed += 1
        } else {
          skipped += 1
        }
      }

      await sleep(MIN_INTERVAL_MS)
    }

    return { processed, failed, skipped }
  }
}

export const emailOrphanEventService = new EmailOrphanEventService()
