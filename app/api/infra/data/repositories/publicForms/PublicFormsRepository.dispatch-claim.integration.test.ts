import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * SPEC 40 — E0 / DA6. O cron de re-despacho (`PublicFormSubmissionDispatchUseCase`)
 * existe para reenfileirar submissões **aceitas** (202 já devolvido ao visitante)
 * cujo enqueue durável falhou. O claim reivindicava por ausência
 * (`dispatchAcceptedAt IS NULL`), condição que as cascas criadas pelo `/progress`
 * satisfazem por construção — `PublicFormSubmission.status` tem
 * `@default(processing)`. Resultado medido em produção: o cron completava
 * formulário em andamento, emitindo `form.completed` para quem ainda estava
 * digitando.
 *
 * O aceite passa a ser fato gravado (`submitRequestedAt`), nunca inferência por
 * ausência. Estes testes rodam contra o Postgres local porque o claim é SQL cru
 * (`FOR UPDATE SKIP LOCKED`) — um fake de Prisma não provaria o filtro.
 *
 * Rodar: `bun run test:integration:public-forms:local` (Postgres em :55322).
 */
const RUN_INTEGRATION =
  process.env.PUBLIC_FORMS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let publicFormsRepository: typeof import("./PublicFormsRepository").publicFormsRepository
let PublicFormSubmissionDispatchUseCase: typeof import("@/app/api/useCases/publicFormSubmissionDispatch/PublicFormSubmissionDispatchUseCase").PublicFormSubmissionDispatchUseCase

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ publicFormsRepository } = await import("./PublicFormsRepository"))
  ;({ PublicFormSubmissionDispatchUseCase } = await import(
    "@/app/api/useCases/publicFormSubmissionDispatch/PublicFormSubmissionDispatchUseCase"
  ))
}

const scope = {
  profileId: "",
  teamId: "",
  formId: "",
  publicationId: "",
}

const questionId = randomUUID()

async function seedFormChain(): Promise<void> {
  const profile = await prisma.profile.create({
    data: { email: `spec40-e0-${randomUUID()}@example.test`, fullName: "Spec 40 E0" },
    select: { id: true },
  })
  scope.profileId = profile.id

  const team = await prisma.team.create({
    data: { name: `Spec 40 E0 ${randomUUID()}`, masterId: profile.id },
    select: { id: true },
  })
  scope.teamId = team.id

  const form = await prisma.publicForm.create({
    data: { teamId: team.id, createdById: profile.id, name: "Spec 40 E0" },
    select: { id: true },
  })
  scope.formId = form.id

  const publication = await prisma.publicFormPublication.create({
    data: {
      formId: form.id,
      publishedById: profile.id,
      version: 1,
      snapshot: {
        formId: form.id,
        version: 1,
        questions: [{ id: questionId, title: "Nome", type: "text", required: true, options: [] }],
        rules: [],
        scoreBands: [],
      },
    },
    select: { id: true },
  })
  scope.publicationId = publication.id
}

async function createSubmission(input: {
  requestKey: string
  submitRequestedAt: Date | null
}): Promise<string> {
  const submission = await prisma.publicFormSubmission.create({
    data: {
      formId: scope.formId,
      publicationId: scope.publicationId,
      requestKey: input.requestKey,
      visitorSessionId: randomUUID(),
      submitRequestedAt: input.submitRequestedAt,
    },
    select: { id: true },
  })
  return submission.id
}

async function claimIds(): Promise<string[]> {
  const claimed = await publicFormsRepository.claimPendingSubmissionDispatches({
    limit: 100,
    leaseUntil: new Date(Date.now() + 2 * 60_000),
  })
  return claimed.map((submission) => submission.id)
}

describe.if(RUN_INTEGRATION)("PublicFormsRepository.claimPendingSubmissionDispatches", () => {
  beforeAll(async () => {
    await seedFormChain()
  })

  afterAll(async () => {
    if (!scope.teamId) return
    await prisma.publicFormSubmission.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicFormPublication.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicForm.deleteMany({ where: { id: scope.formId } })
    await prisma.team.deleteMany({ where: { id: scope.teamId } })
    await prisma.profile.deleteMany({ where: { id: scope.profileId } })
    await prisma.$disconnect()
  })

  // T-F0.1
  it("nunca reivindica casca de progresso sem aceite gravado", async () => {
    const shellId = await createSubmission({
      requestKey: `progress:${randomUUID()}:${scope.publicationId}`,
      submitRequestedAt: null,
    })

    expect(await claimIds()).not.toContain(shellId)
  })

  // T-F0.2
  it("reivindica aceite real cujo enfileiramento durável falhou", async () => {
    const acceptedId = await createSubmission({
      requestKey: `submit:${randomUUID()}`,
      submitRequestedAt: new Date(),
    })

    expect(await claimIds()).toContain(acceptedId)
  })

  // T-F0.3
  it("deixa a submissão em andamento como processing após o cron rodar", async () => {
    const shellId = await createSubmission({
      requestKey: `progress:${randomUUID()}:${scope.publicationId}`,
      submitRequestedAt: null,
    })
    const queued: string[] = []
    const useCase = new PublicFormSubmissionDispatchUseCase(publicFormsRepository, async (job) => {
      queued.push(job.submissionId)
      return { accepted: true }
    })

    await useCase.execute(100)

    expect(queued).not.toContain(shellId)
    const after = await prisma.publicFormSubmission.findUniqueOrThrow({
      where: { id: shellId },
      select: { status: true, dispatchAcceptedAt: true, submittedAt: true },
    })
    expect(after.status).toBe("processing")
    expect(after.dispatchAcceptedAt).toBeNull()
    expect(after.submittedAt).toBeNull()
  })
})
