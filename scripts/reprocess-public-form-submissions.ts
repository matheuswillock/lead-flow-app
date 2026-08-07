import { PrismaClient } from "@prisma/client"
import { publicFormSubmissionUseCase } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import type { PublicFormSnapshot, PublicFormAnswerInput } from "@/lib/public-forms/types"
import {
  calculatePublicFormScorePercent,
  resolveVisibleQuestionIds,
} from "@/lib/public-forms/engine"

const prisma = new PrismaClient()

const DEFAULT_SUBMISSION_PREFIXES = ["194a4caa", "c58b6545", "76894faf"]

async function resolveSubmissionId(prefix: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM corretor_studio_public_form_submissions
    WHERE id::text LIKE ${`${prefix}%`}
    LIMIT 1
  `
  return rows[0]?.id ?? null
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply")
  const prefixes = argv.filter((arg) => !arg.startsWith("--"))
  return { apply, prefixes: prefixes.length > 0 ? prefixes : DEFAULT_SUBMISSION_PREFIXES }
}

async function reprocessSubmission(submissionId: string, apply: boolean) {
  const submission = await prisma.publicFormSubmission.findUnique({
    where: { id: submissionId },
    include: {
      answers: true,
      publication: { select: { id: true, snapshot: true } },
    },
  })
  if (!submission) {
    console.info(`[skip] submissão não encontrada: ${submissionId}`)
    return
  }

  if (submission.status === "completed" && submission.leadId) {
    console.info(`[skip] ${submissionId} já completed com leadId ${submission.leadId}`)
    return
  }

  const snapshot = submission.publication.snapshot as unknown as PublicFormSnapshot
  const visibleAnswers: PublicFormAnswerInput[] = submission.answers
    .filter((answer) => answer.questionId)
    .map((answer) => ({
      questionId: answer.questionId!,
      value: answer.value,
    }))
  const visibleIds = resolveVisibleQuestionIds(snapshot, visibleAnswers)
  const score = calculatePublicFormScorePercent(snapshot, visibleAnswers)
  const origin =
    submission.origin && typeof submission.origin === "object"
      ? (submission.origin as Record<string, unknown>)
      : {}

  const answerCount = visibleAnswers.length
  const isProgressOnly = answerCount <= 1

  console.info(`[reprocess] ${submissionId}`, {
    status: submission.status,
    leadId: submission.leadId,
    formId: snapshot.formId,
    answers: answerCount,
    apply,
  })

  if (isProgressOnly) {
    if (apply) {
      await prisma.publicFormSubmission.update({
        where: { id: submissionId },
        data: {
          status: "failed",
          errorMessage: "Progress abandonado — recovery script",
        },
      })
      console.info(`[apply] ${submissionId} → failed (progress abandonado)`)
    }
    return
  }

  if (!apply) return

  if (submission.status === "failed") {
    await prisma.publicFormSubmission.update({
      where: { id: submissionId },
      data: { status: "processing", errorMessage: null },
    })
  }

  await publicFormSubmissionUseCase.processInBackground({
    submissionId,
    publicationId: submission.publicationId,
    snapshot,
    visibleAnswers,
    visibleIds,
    score,
    scoreBandLabel: null,
    origin,
    requestKey: submission.requestKey,
    visitorSessionId: submission.visitorSessionId,
    thankYouPageId: null,
    scheduling: undefined,
  })

  const updated = await prisma.publicFormSubmission.findUnique({
    where: { id: submissionId },
    select: { status: true, leadId: true, errorMessage: true },
  })
  console.info(`[done] ${submissionId}`, updated)
}

async function main() {
  const { apply, prefixes } = parseArgs(process.argv.slice(2))
  console.info(
    `[reprocess-public-form-submissions] mode=${apply ? "apply" : "dry-run"} prefixes=${prefixes.join(",")}`,
  )
  for (const prefix of prefixes) {
    const id = await resolveSubmissionId(prefix)
    if (!id) {
      console.info(`[skip] prefix sem match: ${prefix}`)
      continue
    }
    await reprocessSubmission(id, apply)
  }
}

main()
  .catch((error) => {
    console.error("[reprocess-public-form-submissions]", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
