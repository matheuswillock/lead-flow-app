import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * SPEC 40 — E8, T-F8.3. Pergunta publicada nunca é removida fisicamente.
 *
 * O caso medido em 24/08 no form "Lista Fria": as perguntas de e-mail e WhatsApp
 * tinham 11 respostas cada com `questionId = NULL`. A FK é `onDelete: SetNull`,
 * então o hard-delete da pergunta apagava o vínculo e deixava a resposta órfã —
 * preservada só no `questionSnapshot`. Efeito em cascata: o funil por pergunta
 * mostrava "0/0 respostas, N não exibidas" para perguntas que tinham resposta, e
 * a mesma raiz produzia o poison P2003 na fila de métricas ([[50]] E3).
 *
 * `softDeleteQuestionsMissingFromDraft` (20/08, `cfa801f7`) já resolve isso, e
 * há teste unitário com fake de Prisma. O que faltava era prova **contra o banco
 * real**: fake não tem FK, e é a FK que define se o dado sobrevive.
 *
 * Controle negativo (agents.md): trocar o soft-delete por `deleteMany` no
 * `replaceDraftRelations` faz este teste ficar vermelho em
 * `answer.questionId` e `event.questionId` — que é exatamente o dano medido.
 *
 * Rodar: `bun run test:integration:public-forms:local` (Postgres em :55322).
 */
const RUN_INTEGRATION =
  process.env.PUBLIC_FORMS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let publicFormsRepository: typeof import("./PublicFormsRepository").publicFormsRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ publicFormsRepository } = await import("./PublicFormsRepository"))
}

const scope = { profileId: "", teamId: "", formId: "", publicationId: "" }

const KEPT_QUESTION_ID = randomUUID()
const REMOVED_QUESTION_ID = randomUUID()

function draftQuestion(id: string, title: string, position: number) {
  return {
    id,
    type: "text" as const,
    title,
    description: null,
    placeholder: null,
    required: false,
    scoreWeight: position === 0 ? 100 : 0,
    config: {},
    mappingTarget: null,
    mappingKey: null,
    options: [],
  }
}

function draft(questionIds: string[]) {
  return {
    name: "Spec 40 E8",
    description: null,
    assignedSdrId: null,
    eligibleCloserIds: [],
    coverTitle: null,
    coverDescription: null,
    coverBadge: null,
    coverHighlights: [],
    ctaLabel: "Começar",
    successTitle: "Respostas enviadas",
    successDescription: null,
    successActions: [],
    thankYouPages: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Padrão",
        title: "Obrigado",
        description: null,
        actions: [],
        isDefault: true,
      },
    ],
    defaultThankYouPageId: "22222222-2222-4222-8222-222222222222",
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    schedulingMessage: null,
    questions: questionIds.map((id, index) =>
      draftQuestion(id, id === KEPT_QUESTION_ID ? "Nome" : "WhatsApp", index),
    ),
    rules: [],
    scoreBands: [],
  } as unknown as Parameters<typeof publicFormsRepository.updateWithDraft>[1]
}

async function seed(): Promise<void> {
  const profile = await prisma.profile.create({
    data: { email: `spec40-e8-${randomUUID()}@example.test`, fullName: "Spec 40 E8" },
    select: { id: true },
  })
  scope.profileId = profile.id

  const team = await prisma.team.create({
    data: { name: `Spec 40 E8 ${randomUUID()}`, masterId: profile.id },
    select: { id: true },
  })
  scope.teamId = team.id

  const form = await prisma.publicForm.create({
    data: { teamId: team.id, createdById: profile.id, name: "Spec 40 E8" },
    select: { id: true },
  })
  scope.formId = form.id

  // As duas perguntas nascem no rascunho; a segunda é a que o builder remove.
  await publicFormsRepository.updateWithDraft(
    form.id,
    draft([KEPT_QUESTION_ID, REMOVED_QUESTION_ID]),
  )

  const publication = await prisma.publicFormPublication.create({
    data: {
      formId: form.id,
      publishedById: profile.id,
      version: 1,
      snapshot: {
        formId: form.id,
        version: 1,
        questions: [
          { id: KEPT_QUESTION_ID, title: "Nome", type: "text", required: false, options: [] },
          { id: REMOVED_QUESTION_ID, title: "WhatsApp", type: "text", required: false, options: [] },
        ],
        rules: [],
        scoreBands: [],
      },
    },
    select: { id: true },
  })
  scope.publicationId = publication.id

  const submission = await prisma.publicFormSubmission.create({
    data: {
      formId: form.id,
      publicationId: publication.id,
      requestKey: `spec40-e8-${randomUUID()}`,
      visitorSessionId: randomUUID(),
    },
    select: { id: true },
  })

  // Uma resposta e um evento apontando para a pergunta que será removida.
  await prisma.publicFormAnswer.create({
    data: {
      submissionId: submission.id,
      questionId: REMOVED_QUESTION_ID,
      value: "11987654321",
      questionSnapshot: { id: REMOVED_QUESTION_ID, title: "WhatsApp" },
    },
  })
  await prisma.publicFormMetricEvent.create({
    data: {
      formId: form.id,
      publicationId: publication.id,
      questionId: REMOVED_QUESTION_ID,
      visitorSessionId: "spec40-e8-session",
      eventType: "question_answered",
      eventKey: `spec40-e8-${randomUUID()}`,
      origin: {},
    },
  })
}

describe.if(RUN_INTEGRATION)("PublicFormsRepository — pergunta publicada não é hard-deletada", () => {
  beforeAll(async () => {
    await seed()
    // O builder salva o form sem a pergunta de WhatsApp.
    await publicFormsRepository.updateWithDraft(scope.formId, draft([KEPT_QUESTION_ID]))
  })

  afterAll(async () => {
    if (!scope.teamId) return
    await prisma.publicFormMetricEvent.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicFormAnswer.deleteMany({
      where: { submission: { formId: scope.formId } },
    })
    await prisma.publicFormSubmission.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicFormPublication.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicFormOption.deleteMany({ where: { question: { formId: scope.formId } } })
    await prisma.publicFormQuestion.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicForm.deleteMany({ where: { id: scope.formId } })
    await prisma.team.deleteMany({ where: { id: scope.teamId } })
    await prisma.profile.deleteMany({ where: { id: scope.profileId } })
    await prisma.$disconnect()
  })

  it("a linha da pergunta sobrevive com deletedAt, fora da faixa de position viva", async () => {
    const removed = await prisma.publicFormQuestion.findUnique({
      where: { id: REMOVED_QUESTION_ID },
      select: { deletedAt: true, position: true },
    })

    expect(removed, "hard-delete: a pergunta sumiu da tabela").not.toBeNull()
    expect(removed?.deletedAt).not.toBeNull()
    expect(removed?.position).toBeGreaterThanOrEqual(1_000_000)
  })

  it("a resposta mantém o vínculo — nada de questionId NULL", async () => {
    const answer = await prisma.publicFormAnswer.findFirst({
      where: { questionSnapshot: { path: ["id"], equals: REMOVED_QUESTION_ID } },
      select: { questionId: true, value: true },
    })

    expect(answer, "resposta sumiu").not.toBeNull()
    expect(answer?.questionId).toBe(REMOVED_QUESTION_ID)
  })

  it("o evento de métrica mantém o vínculo — o funil continua contando", async () => {
    const event = await prisma.publicFormMetricEvent.findFirst({
      where: { formId: scope.formId, visitorSessionId: "spec40-e8-session" },
      select: { questionId: true },
    })

    expect(event?.questionId).toBe(REMOVED_QUESTION_ID)
  })

  it("o builder não enxerga mais a pergunta removida", async () => {
    const detail = await publicFormsRepository.findDetailByTeamAndId(scope.teamId, scope.formId)

    expect(detail?.questions.map((question) => question.id)).toEqual([KEPT_QUESTION_ID])
  })

  it("readicionar a pergunta reusa a mesma linha, sem id novo", async () => {
    await publicFormsRepository.updateWithDraft(
      scope.formId,
      draft([KEPT_QUESTION_ID, REMOVED_QUESTION_ID]),
    )

    const revived = await prisma.publicFormQuestion.findUnique({
      where: { id: REMOVED_QUESTION_ID },
      select: { deletedAt: true, position: true },
    })
    const rows = await prisma.publicFormQuestion.count({ where: { formId: scope.formId } })

    expect(revived?.deletedAt).toBeNull()
    expect(revived?.position).toBe(1)
    // Duas linhas, não três: reordenar/readicionar não cria pergunta nova — a
    // recriação com id novo é o que órfã os dados (E8, passo 4).
    expect(rows).toBe(2)
  })
})
