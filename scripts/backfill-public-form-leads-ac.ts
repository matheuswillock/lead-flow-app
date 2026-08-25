#!/usr/bin/env tsx
/**
 * Backfill #1–#7 MultiSkill: cria/anexa Lead no CRM para submissões públicas
 * completed sem leadId que agora passam no gate A+C.
 *
 * Dry-run é o padrão. `--apply` grava no banco apontado por DATABASE_URL
 * e só deve rodar com autorização explícita — nunca contra remoto sem o owner.
 *
 * Uso:
 *   bun run scripts/backfill-public-form-leads-ac.ts
 *   bun run scripts/backfill-public-form-leads-ac.ts --apply
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import {
  extractLeadDataFromSnapshot,
  findMatchingLead,
  hasCrmGateAC,
  upsertLeadFromFormAnswers,
} from "@/app/api/useCases/publicForms/publicFormLeadSync"
import { resolveVisibleQuestionIds } from "@/lib/public-forms/engine"
import {
  assertApprovedPublicFormLeadBackfillFixture,
  parsePublicFormLeadBackfillArgs,
  resolveBackfillMetricSessionId,
  runPublicFormLeadBackfill,
  type PublicFormLeadBackfillCandidate,
  type PublicFormLeadBackfillFixture,
} from "@/lib/public-forms/backfill-public-form-leads-ac"
import { buildPublicFormMetricEventKey } from "@/lib/public-forms/metric-keys"
import {
  buildPublicFormMetricQueuePayload,
  publishServerPublicFormMetricEvent,
} from "@/lib/queues/public-form-metric-events"
import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/public-form-leads-ac.json",
)

const BACKFILL_NOTE = "Lead recuperado via backfill A+C (formulário público)."

type SubmissionRow = {
  id: string
  formId: string
  publicationId: string
  leadId: string | null
  visitorSessionId: string | null
  requestKey: string
  score: number
  scoreBandLabel: string | null
  origin: unknown
  form: { id: string; name: string; publicId: string; teamId: string; team: { name: string } }
  publication: { id: string; snapshot: unknown }
  answers: Array<{ questionId: string | null; value: unknown }>
}

type ApplyPayload = {
  submission: SubmissionRow
  snapshot: PublicFormSnapshot
  answers: PublicFormAnswerInput[]
  visibleIds: Set<string>
  origin: Record<string, unknown>
}

function loadFixture(): PublicFormLeadBackfillFixture {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as PublicFormLeadBackfillFixture
  assertApprovedPublicFormLeadBackfillFixture(fixture)
  return fixture
}

function asOrigin(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function findSubmissionIdsByPrefix(prefix: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM corretor_studio_public_form_submissions
    WHERE id::text LIKE ${`${prefix}%`}
    LIMIT 3
  `
  return rows.map((row) => row.id)
}

async function loadSubmission(submissionId: string): Promise<SubmissionRow | null> {
  return prisma.publicFormSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      formId: true,
      publicationId: true,
      leadId: true,
      visitorSessionId: true,
      requestKey: true,
      score: true,
      scoreBandLabel: true,
      origin: true,
      form: {
        select: {
          id: true,
          name: true,
          publicId: true,
          teamId: true,
          team: { select: { name: true } },
        },
      },
      publication: { select: { id: true, snapshot: true } },
      answers: { select: { questionId: true, value: true } },
    },
  })
}

function answersFromSubmission(submission: SubmissionRow): PublicFormAnswerInput[] {
  return submission.answers
    .filter((answer) => Boolean(answer.questionId))
    .map((answer) => ({
      questionId: answer.questionId as string,
      value: answer.value,
    }))
}

function emptyCandidate(
  fixtureCase: PublicFormLeadBackfillFixture["cases"][number],
  submissionIds: string[],
): PublicFormLeadBackfillCandidate<ApplyPayload | null> {
  return {
    fixtureCase,
    submissionIds,
    teamName: null,
    existingLeadId: null,
    extractedName: "",
    passesGate: false,
    matchingLeadId: null,
    payload: null,
  }
}

async function buildCandidate(
  fixtureCase: PublicFormLeadBackfillFixture["cases"][number],
): Promise<PublicFormLeadBackfillCandidate<ApplyPayload | null>> {
  const submissionIds = await findSubmissionIdsByPrefix(fixtureCase.submissionPrefix)
  if (submissionIds.length !== 1) {
    return emptyCandidate(fixtureCase, submissionIds)
  }

  const submissionId = submissionIds[0]
  if (!submissionId) {
    return emptyCandidate(fixtureCase, [])
  }

  const submission = await loadSubmission(submissionId)
  if (!submission) {
    return emptyCandidate(fixtureCase, [])
  }

  const snapshot = submission.publication.snapshot as unknown as PublicFormSnapshot
  const answers = answersFromSubmission(submission)
  const visibleIds = new Set(resolveVisibleQuestionIds(snapshot, answers))
  const extracted = extractLeadDataFromSnapshot(snapshot, answers, visibleIds)
  const matchingLead = await findMatchingLead(submission.form.teamId, extracted)

  return {
    fixtureCase,
    submissionIds,
    teamName: submission.form.team.name,
    existingLeadId: submission.leadId,
    extractedName: extracted.name,
    passesGate: hasCrmGateAC(extracted),
    matchingLeadId: matchingLead?.id ?? null,
    payload: {
      submission,
      snapshot,
      answers,
      visibleIds,
      origin: asOrigin(submission.origin),
    },
  }
}

async function persistLeadMetric(input: {
  submission: SubmissionRow
  eventType: "lead_created" | "lead_attached"
  origin: Record<string, unknown>
}): Promise<void> {
  const visitorSessionId = resolveBackfillMetricSessionId({
    visitorSessionId: input.submission.visitorSessionId,
    requestKey: input.submission.requestKey,
  })
  const eventKey = buildPublicFormMetricEventKey(visitorSessionId, input.eventType)
  await prisma.publicFormMetricEvent.upsert({
    where: { eventKey },
    create: {
      formId: input.submission.formId,
      publicationId: input.submission.publicationId,
      visitorSessionId,
      eventType: input.eventType,
      eventKey,
      origin: json(input.origin),
    },
    update: {},
  })
  await publishServerPublicFormMetricEvent(
    buildPublicFormMetricQueuePayload(input.submission.form.publicId, {
      visitorSessionId,
      eventType: input.eventType,
      eventKey,
      origin: input.origin,
    }),
    "backfill-public-form-leads-ac",
  )
}

async function applyLead(
  candidate: PublicFormLeadBackfillCandidate<ApplyPayload | null>,
): Promise<string> {
  const payload = candidate.payload
  if (!payload) {
    throw new Error("Candidato sem payload de submissão")
  }

  const form = await publicFormsRepository.findFormSubmissionContext(payload.submission.formId)
  const upserted = await upsertLeadFromFormAnswers({
    form,
    snapshot: payload.snapshot,
    answers: payload.answers,
    visibleIds: payload.visibleIds,
    score: payload.submission.score,
    scoreBandLabel: payload.submission.scoreBandLabel,
    submissionId: payload.submission.id,
    publicationId: payload.submission.publicationId,
    origin: payload.origin,
    extraNotes: [BACKFILL_NOTE],
    allowCreate: true,
  })
  if (upserted.outcome === "discarded") {
    throw new Error(`upsertLeadFromFormAnswers descartou o lead: ${upserted.reason}`)
  }
  if (upserted.outcome === "skipped") {
    throw new Error("upsertLeadFromFormAnswers não criou nem atualizou o lead")
  }

  const eventType = upserted.outcome === "created" ? "lead_created" : "lead_attached"
  const visitorSessionId = resolveBackfillMetricSessionId({
    visitorSessionId: payload.submission.visitorSessionId,
    requestKey: payload.submission.requestKey,
  })
  const eventKey = buildPublicFormMetricEventKey(visitorSessionId, eventType)

  await prisma.$transaction(async (tx) => {
    await tx.publicFormSubmission.update({
      where: { id: payload.submission.id },
      data: { leadId: upserted.lead.id },
    })
    await tx.publicFormMetricEvent.upsert({
      where: { eventKey },
      create: {
        formId: payload.submission.formId,
        publicationId: payload.submission.publicationId,
        visitorSessionId,
        eventType,
        eventKey,
        origin: json(payload.origin),
      },
      update: {},
    })
  })

  await publishServerPublicFormMetricEvent(
    buildPublicFormMetricQueuePayload(payload.submission.form.publicId, {
      visitorSessionId,
      eventType,
      eventKey,
      origin: payload.origin,
    }),
    "backfill-public-form-leads-ac",
  )

  return upserted.lead.id
}

async function repairAlreadyAttached(
  candidate: PublicFormLeadBackfillCandidate<ApplyPayload | null>,
): Promise<void> {
  const payload = candidate.payload
  if (!payload) return

  const visitorSessionId = resolveBackfillMetricSessionId({
    visitorSessionId: payload.submission.visitorSessionId,
    requestKey: payload.submission.requestKey,
  })
  const existing = await prisma.publicFormMetricEvent.findFirst({
    where: {
      visitorSessionId,
      eventType: { in: ["lead_created", "lead_attached"] },
    },
    select: { id: true },
  })
  if (existing) return

  await persistLeadMetric({
    submission: payload.submission,
    eventType: "lead_attached",
    origin: payload.origin,
  })
}

async function main() {
  const { apply } = parsePublicFormLeadBackfillArgs(process.argv.slice(2))
  const fixture = loadFixture()

  console.info(
    `[backfill-public-form-leads-ac] mode=${apply ? "apply" : "dry-run"} cases=${fixture.cases.length}`,
  )
  if (apply) {
    console.info(
      "[backfill-public-form-leads-ac] --apply grava no DATABASE_URL atual; use só com autorização",
    )
  }

  const candidates: Array<PublicFormLeadBackfillCandidate<ApplyPayload | null>> = []
  for (const fixtureCase of fixture.cases) {
    candidates.push(await buildCandidate(fixtureCase))
  }

  const result = await runPublicFormLeadBackfill({
    apply,
    expectedTeamNameContains: fixture.expectedTeamNameContains,
    candidates,
    applyLead,
    repairAlreadyAttached,
  })

  for (const row of result.rows) {
    console.info("[backfill-public-form-leads-ac] case", {
      id: row.id,
      prefix: row.submissionPrefix,
      action: row.action,
      expectedName: row.expectedName,
      extractedName: row.extractedName,
      submissionId: row.submissionId,
      leadId: row.leadId,
      error: row.error ?? null,
    })
  }

  console.info("[backfill-public-form-leads-ac] summary", {
    mode: result.mode,
    total: result.total,
    wouldCreate: result.wouldCreate,
    wouldAttach: result.wouldAttach,
    created: result.created,
    attached: result.attached,
    skipped: result.skipped,
    failed: result.failed,
  })

  if (result.failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error("[backfill-public-form-leads-ac]", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
