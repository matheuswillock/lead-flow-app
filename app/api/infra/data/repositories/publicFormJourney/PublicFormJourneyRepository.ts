import { Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  applyPublicFormJourneyEvent,
  createInitialJourneyProjection,
  type PublicFormJourneySessionProjection,
} from "@/lib/public-forms/journey-session"
import type {
  AbandonedJourneyCandidate,
  IPublicFormJourneyRepository,
  RecordJourneyEventInput,
  RecordJourneyEventResult,
} from "./IPublicFormJourneyRepository"

type JourneySessionRow = {
  id: string
  state: "active" | "abandoned" | "completed"
  lastActivityAt: Date
  currentPageId: string | null
  currentPageIndex: number | null
  lastExitIntentAt: Date | null
  lastAbandonedAt: Date | null
  lastResumedAt: Date | null
  abandonmentCount: number
  submittedAt: Date | null
  completedAt: Date | null
}

function toProjection(row: JourneySessionRow): PublicFormJourneySessionProjection {
  return {
    state: row.state,
    lastActivityAt: row.lastActivityAt,
    currentPageId: row.currentPageId,
    currentPageIndex: row.currentPageIndex,
    lastExitIntentAt: row.lastExitIntentAt,
    lastAbandonedAt: row.lastAbandonedAt,
    lastResumedAt: row.lastResumedAt,
    abandonmentCount: row.abandonmentCount,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
  }
}

export class PublicFormJourneyRepository implements IPublicFormJourneyRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Lock por `(publicationId, visitorSessionId)` antes do reload: duas
   * entregas concorrentes do mesmo visitante serializam em vez de perder uma
   * transição por leitura suja.
   */
  async recordJourneyEvent(input: RecordJourneyEventInput): Promise<RecordJourneyEventResult> {
    return this.db.$transaction(
      async (tx) => {
        const lockKey = `public-form-journey:${input.publicationId}:${input.visitorSessionId}`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

        const existing = (await tx.publicFormJourneySession.findUnique({
          where: {
            publicationId_visitorSessionId: {
              publicationId: input.publicationId,
              visitorSessionId: input.visitorSessionId,
            },
          },
          select: {
            id: true,
            state: true,
            lastActivityAt: true,
            currentPageId: true,
            currentPageIndex: true,
            lastExitIntentAt: true,
            lastAbandonedAt: true,
            lastResumedAt: true,
            abandonmentCount: true,
            submittedAt: true,
            completedAt: true,
          },
        })) as JourneySessionRow | null

        const current = existing
          ? toProjection(existing)
          : createInitialJourneyProjection(input.event.occurredAt)
        const transition = applyPublicFormJourneyEvent(current, input.event)

        if (existing && !transition.changed) {
          return {
            sessionId: existing.id,
            projection: current,
            derivedEvent: null,
          }
        }

        const session = await tx.publicFormJourneySession.upsert({
          where: {
            publicationId_visitorSessionId: {
              publicationId: input.publicationId,
              visitorSessionId: input.visitorSessionId,
            },
          },
          create: {
            formId: input.formId,
            publicationId: input.publicationId,
            visitorSessionId: input.visitorSessionId,
            startedAt: input.event.occurredAt,
            ...transition.projection,
          },
          update: transition.projection,
          select: { id: true },
        })

        return {
          sessionId: session.id,
          projection: transition.projection,
          derivedEvent: transition.derivedEvent,
        }
      },
      { timeout: 15_000 },
    )
  }

  /**
   * `SKIP LOCKED` + `UPDATE ... RETURNING` em um único comando: o claim e a
   * marcação são atômicos, então dois crons concorrentes nunca abandonam a
   * mesma sessão. `completed` fica fora do filtro por definição.
   *
   * Nomes físicos conferidos em prisma/schema.prisma:
   * `corretor_studio_public_form_journey_sessions`, enum
   * `public_form_journey_state`.
   */
  async claimAbandonedJourneySessions(input: {
    idleBefore: Date
    limit: number
  }): Promise<AbandonedJourneyCandidate[]> {
    const rows = await this.db.$queryRaw<
      {
        id: string
        formId: string
        publicId: string
        publicationId: string
        visitorSessionId: string
        lastActivityAt: Date
        abandonmentCount: number
      }[]
    >(Prisma.sql`
      WITH claimed AS (
        SELECT "id"
        FROM "public"."corretor_studio_public_form_journey_sessions"
        WHERE "state" = 'active'::public.public_form_journey_state
          AND "lastActivityAt" <= ${input.idleBefore}
        ORDER BY "lastActivityAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
      )
      UPDATE "public"."corretor_studio_public_form_journey_sessions" AS s
      SET "state" = 'abandoned'::public.public_form_journey_state,
          "lastAbandonedAt" = now(),
          "abandonmentCount" = s."abandonmentCount" + 1,
          "updatedAt" = now()
      FROM claimed, "public"."corretor_studio_public_forms" AS f
      WHERE s."id" = claimed."id" AND f."id" = s."formId"
      RETURNING s."id", s."formId", f."publicId", s."publicationId", s."visitorSessionId",
                s."lastActivityAt", s."abandonmentCount"
    `)

    return rows.map((row) => ({
      sessionId: row.id,
      formId: row.formId,
      publicId: row.publicId,
      publicationId: row.publicationId,
      visitorSessionId: row.visitorSessionId,
      lastActivityAt: row.lastActivityAt,
      abandonmentCount: row.abandonmentCount,
    }))
  }
}

export const publicFormJourneyRepository = new PublicFormJourneyRepository()
