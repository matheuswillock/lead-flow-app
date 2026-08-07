import { PrismaClient } from "@prisma/client"
import { resolveEmailCampaignFormAttributionUseCase } from "@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase"

const prisma = new PrismaClient()

type RecoveryCase = {
  label: string
  teamId: string
  formId: string
  formName: string
  formPublicId: string
  publicationId: string
  emailLogId: string
  visitorSessionId: string
  origin: Record<string, unknown>
}

const DEFAULT_CASES: RecoveryCase[] = [
  {
    label: "Kathrein form_started brunorodrigues_adv",
    teamId: "7b577c22-5513-42cc-ab19-2bf867e14ebc",
    formId: "74c7fea8-9bac-4137-bc64-a02f3c674d69",
    formName: "Kathrein form",
    formPublicId: "placeholder",
    publicationId: "placeholder",
    emailLogId: "5521c9b6-0000-4000-8000-000000000001",
    visitorSessionId: "recovery-kathrein-form-started",
    origin: {
      source: "email_campaign",
      emailLogId: "5521c9b6-0000-4000-8000-000000000001",
    },
  },
]

async function buildCaseFromMetricEvent(eventId: string): Promise<RecoveryCase | null> {
  const event = await prisma.publicFormMetricEvent.findUnique({
    where: { id: eventId },
    include: {
      form: { select: { id: true, name: true, publicId: true, teamId: true, emailCampaignTrackingEnabled: true } },
    },
  })
  if (!event?.form) return null
  const origin =
    event.origin && typeof event.origin === "object"
      ? (event.origin as Record<string, unknown>)
      : {}
  return {
    label: `metric:${event.id}`,
    teamId: event.form.teamId,
    formId: event.form.id,
    formName: event.form.name,
    formPublicId: event.form.publicId,
    publicationId: event.publicationId,
    emailLogId: String(origin.emailLogId ?? ""),
    visitorSessionId: event.visitorSessionId,
    origin,
  }
}

async function recoverCase(caseInput: RecoveryCase, apply: boolean) {
  const form = await prisma.publicForm.findUnique({
    where: { id: caseInput.formId },
    select: { emailCampaignTrackingEnabled: true, publicId: true, name: true },
  })
  if (!form) {
    console.info(`[skip] form não encontrado: ${caseInput.formId}`)
    return
  }

  console.info(`[recover] ${caseInput.label}`, {
    teamId: caseInput.teamId,
    formId: caseInput.formId,
    emailLogId: caseInput.emailLogId,
    apply,
  })

  if (!apply) return

  const output = await resolveEmailCampaignFormAttributionUseCase.execute({
    teamId: caseInput.teamId,
    formId: caseInput.formId,
    formName: form.name,
    formPublicId: form.publicId,
    publicationId: caseInput.publicationId,
    emailCampaignTrackingEnabled: form.emailCampaignTrackingEnabled,
    eventType: "form_started",
    origin: caseInput.origin,
    visitorSessionId: caseInput.visitorSessionId,
  })

  console.info(`[result] ${caseInput.label}`, {
    isValid: output.isValid,
    errors: output.errorMessages,
    result: output.result,
  })
}

async function recoverFromFormStartedMetrics(apply: boolean, teamId?: string) {
  const events = await prisma.publicFormMetricEvent.findMany({
    where: {
      eventType: "form_started",
      ...(teamId ? { form: { teamId } } : {}),
    },
    select: {
      id: true,
      publicationId: true,
      visitorSessionId: true,
      origin: true,
      formId: true,
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  })

  for (const event of events) {
    const origin =
      event.origin && typeof event.origin === "object"
        ? (event.origin as Record<string, unknown>)
        : {}
    const emailLogId = typeof origin.emailLogId === "string" ? origin.emailLogId : null
    if (!emailLogId) continue

    const log = await prisma.emailLog.findFirst({
      where: { id: emailLogId },
      select: { recipientEmail: true },
    })
    if (!log?.recipientEmail) continue

    const existingLead = await prisma.lead.findFirst({
      where: {
        teamId: teamId ?? undefined,
        email: { equals: log.recipientEmail, mode: "insensitive" },
      },
      select: { id: true },
    })
    if (existingLead) continue

    const form = await prisma.publicForm.findUnique({
      where: { id: event.formId },
      select: { teamId: true, name: true, publicId: true, emailCampaignTrackingEnabled: true },
    })
    if (!form) continue

    await recoverCase(
      {
        label: `auto-metric:${event.id}`,
        teamId: form.teamId,
        formId: event.formId,
        formName: form.name,
        formPublicId: form.publicId,
        publicationId: event.publicationId,
        emailLogId,
        visitorSessionId: event.visitorSessionId,
        origin,
      },
      apply,
    )
  }
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply")
  const scanMetrics = argv.includes("--scan-metrics")
  const teamId = argv.find((arg) => arg.startsWith("--team="))?.slice("--team=".length)
  const metricEventId = argv.find((arg) => arg.startsWith("--metric="))?.slice("--metric=".length)
  return { apply, scanMetrics, teamId, metricEventId }
}

async function main() {
  const { apply, scanMetrics, teamId, metricEventId } = parseArgs(process.argv.slice(2))
  console.info(
    `[recover-campaign-attribution-leads] mode=${apply ? "apply" : "dry-run"} scanMetrics=${scanMetrics}`,
  )

  if (metricEventId) {
    const caseInput = await buildCaseFromMetricEvent(metricEventId)
    if (caseInput) await recoverCase(caseInput, apply)
    return
  }

  if (scanMetrics) {
    await recoverFromFormStartedMetrics(apply, teamId)
    return
  }

  for (const caseInput of DEFAULT_CASES) {
    await recoverCase(caseInput, apply)
  }
}

main()
  .catch((error) => {
    console.error("[recover-campaign-attribution-leads]", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
