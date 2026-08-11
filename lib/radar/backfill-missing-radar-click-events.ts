import type { Prisma } from "@prisma/client"
import type { AppendEventInput } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { buildEmailEventMetadata } from "@/lib/radar/segment-rules"

export type BackfillClickCandidate = {
  logId: string
  teamId: string
  recipientEmail: string
  recipientName: string | null
  campaignId: string | null
  occurredAt: Date
  metadata?: Record<string, unknown>
}

export type BackfillRunResult = {
  mode: "dry-run" | "apply"
  total: number
  wouldCreate: number
  created: number
  skippedExisting: number
  failed: number
  errors: Array<{ logId: string; error: string }>
}

export type BackfillRunnerDeps = {
  apply: boolean
  candidates: BackfillClickCandidate[]
  hasExistingEvent: (candidate: BackfillClickCandidate) => Promise<boolean>
  resolveProfileId: (candidate: BackfillClickCandidate) => Promise<string | null>
  appendEventIfNew: (input: AppendEventInput) => Promise<{ id: string } | null>
}

export function buildAppendEventInput(
  candidate: BackfillClickCandidate,
  profileId: string
): AppendEventInput {
  return {
    profileId,
    teamId: candidate.teamId,
    eventType: "email.clicked",
    sourceType: "email_log",
    sourceId: candidate.logId,
    occurredAt: candidate.occurredAt,
    metadata: buildEmailEventMetadata(
      candidate.campaignId,
      candidate.metadata
    ) as Prisma.InputJsonValue,
  }
}

export async function runBackfillMissingRadarClickEvents(
  deps: BackfillRunnerDeps
): Promise<BackfillRunResult> {
  const result: BackfillRunResult = {
    mode: deps.apply ? "apply" : "dry-run",
    total: deps.candidates.length,
    wouldCreate: 0,
    created: 0,
    skippedExisting: 0,
    failed: 0,
    errors: [],
  }

  for (const candidate of deps.candidates) {
    try {
      const exists = await deps.hasExistingEvent(candidate)
      if (exists) {
        result.skippedExisting += 1
        continue
      }

      if (!deps.apply) {
        result.wouldCreate += 1
        continue
      }

      const profileId = await deps.resolveProfileId(candidate)
      if (!profileId) {
        result.failed += 1
        result.errors.push({
          logId: candidate.logId,
          error: "Perfil Radar não resolvido para o destinatário do log",
        })
        continue
      }

      const created = await deps.appendEventIfNew(
        buildAppendEventInput(candidate, profileId)
      )

      if (created) {
        result.created += 1
      } else {
        result.skippedExisting += 1
      }
    } catch (error) {
      result.failed += 1
      result.errors.push({
        logId: candidate.logId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}
