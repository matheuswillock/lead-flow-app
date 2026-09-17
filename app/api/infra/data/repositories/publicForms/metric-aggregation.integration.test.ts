import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"

/**
 * Caracterização + escala da agregação de eventos de métrica (SPEC 30 — E4).
 *
 * T-M4.1 exige que o SQL devolva exatamente o que o caminho antigo (dedupe em
 * JS) devolvia — por isso a referência em memória continua versionada em
 * `lib/public-forms/metric-event-aggregation.ts` e é executada aqui contra a
 * mesma base. T-M4.2 mede o custo com 100 mil eventos: o caminho antigo trazia
 * as 100 mil linhas para o processo.
 *
 * Roda só com Postgres local:
 *   bun run test:aggregation:local
 */
const RUN_INTEGRATION =
  process.env.METRIC_AGGREGATION_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let publicFormsRepository: typeof import("./PublicFormsRepository").publicFormsRepository
let emailAnalyticsRepository: typeof import("../emailAnalytics/EmailAnalyticsRepository").emailAnalyticsRepository
let countUniqueFormMetricRecipients: typeof import("@/lib/email/unique-form-metric-recipients").countUniqueFormMetricRecipients
let groupMetricEventsInMemory: typeof import("@/lib/public-forms/metric-event-aggregation").groupMetricEventsInMemory
let countDistinctSessionsByEventTypeInMemory: typeof import("@/lib/public-forms/metric-event-aggregation").countDistinctSessionsByEventTypeInMemory
let sortGroupedMetricEvents: typeof import("@/lib/public-forms/metric-event-aggregation").sortGroupedMetricEvents

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ publicFormsRepository } = await import("./PublicFormsRepository"))
  ;({ emailAnalyticsRepository } = await import("../emailAnalytics/EmailAnalyticsRepository"))
  ;({ countUniqueFormMetricRecipients } = await import(
    "@/lib/email/unique-form-metric-recipients"
  ))
  ;({
    groupMetricEventsInMemory,
    countDistinctSessionsByEventTypeInMemory,
    sortGroupedMetricEvents,
  } = await import("@/lib/public-forms/metric-event-aggregation"))
}

const scope = { teamId: "", formId: "", publicationId: "", questionId: "" }

/** Espelha o `select` que o caminho antigo usava para deduplicar em JS. */
async function loadRawRows() {
  return prisma.publicFormMetricEvent.findMany({
    where: { formId: scope.formId },
    select: {
      eventType: true,
      publicationId: true,
      questionId: true,
      questionSnapshot: true,
      visitorSessionId: true,
    },
  })
}

describe.skipIf(!RUN_INTEGRATION)("Agregação de métricas no banco", () => {
  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const master = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `agg-${suffix}@test.local`,
        supabaseId: randomUUID(),
        fullName: "Agg Master",
        isMaster: true,
      },
    })
    const team = await prisma.team.create({
      data: { name: `Agg ${suffix}`, masterId: master.id },
    })
    scope.teamId = team.id

    const form = await prisma.publicForm.create({
      data: {
        team: { connect: { id: team.id } },
        creator: { connect: { id: master.id } },
        publicId: randomUUID(),
        name: `Form ${suffix}`,
        status: "published",
        approvalStatus: "approved",
      },
    })
    scope.formId = form.id

    const question = await prisma.publicFormQuestion.create({
      data: {
        form: { connect: { id: form.id } },
        type: "text",
        title: "E-mail",
        position: 1,
        mappingKey: "email",
      },
    })
    scope.questionId = question.id

    const publication = await prisma.publicFormPublication.create({
      data: {
        form: { connect: { id: form.id } },
        version: 1,
        snapshot: { formId: form.id, questions: [] },
        publishedBy: { connect: { id: master.id } },
      },
    })
    scope.publicationId = publication.id
  })

  afterAll(async () => {
    if (!scope.teamId) return
    await prisma.publicFormMetricEvent.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicFormPublication.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicFormQuestion.deleteMany({ where: { formId: scope.formId } })
    await prisma.publicForm.deleteMany({ where: { id: scope.formId } })
    await prisma.team.deleteMany({ where: { id: scope.teamId } })
  })

  it("T-M4.1 — groupBy no banco devolve o mesmo resultado do caminho antigo", async () => {
    const snapshot = { id: scope.questionId, title: "E-mail", position: 1, mappingKey: "email" }
    const rows = [
      // Sessão repetindo o mesmo evento: conta uma vez só.
      ...Array.from({ length: 5 }, (_, index) => ({
        eventType: "question_answered" as const,
        visitorSessionId: "s-1",
        questionId: scope.questionId,
        questionSnapshot: snapshot,
        eventKey: `s-1:answered:${index}`,
      })),
      {
        eventType: "question_answered" as const,
        visitorSessionId: "s-2",
        questionId: scope.questionId,
        questionSnapshot: snapshot,
        eventKey: "s-2:answered",
      },
      // Pergunta recriada no builder: FK nula, snapshot intacto (caso Lista Fria).
      {
        eventType: "question_answered" as const,
        visitorSessionId: "s-3",
        questionId: null,
        questionSnapshot: snapshot,
        eventKey: "s-3:answered-orfa",
      },
      {
        eventType: "form_viewed" as const,
        visitorSessionId: "s-1",
        questionId: null,
        questionSnapshot: undefined,
        eventKey: "s-1:viewed",
      },
      {
        eventType: "form_completed" as const,
        visitorSessionId: "s-2",
        questionId: null,
        questionSnapshot: undefined,
        eventKey: "s-2:completed",
      },
    ]

    await prisma.publicFormMetricEvent.createMany({
      data: rows.map((row) => ({
        formId: scope.formId,
        publicationId: scope.publicationId,
        questionId: row.questionId,
        questionSnapshot: row.questionSnapshot,
        visitorSessionId: row.visitorSessionId,
        eventType: row.eventType,
        eventKey: `${scope.formId}:${row.eventKey}`,
      })),
    })

    const raw = await loadRawRows()
    const expected = sortGroupedMetricEvents(groupMetricEventsInMemory(raw))
    const actual = sortGroupedMetricEvents(
      await publicFormsRepository.groupMetricEvents({ formId: scope.formId })
    )

    expect(actual).toEqual(expected)

    // A pergunta órfã soma com a viva: três sessões, não duas + zero.
    const answered = actual.find((row) => row.eventType === "question_answered")
    expect(answered?.uniqueSessions).toBe(3)
    expect(answered?.questionId).toBe(scope.questionId)

    const sessionsByType = await publicFormsRepository.countDistinctSessionsByEventType({
      formId: scope.formId,
    })
    expect(sessionsByType).toEqual(countDistinctSessionsByEventTypeInMemory(raw))
  })

  it("T-M4.1b — destinatários únicos no banco batem com a dedupe antiga em JS", async () => {
    const rows = [
      // Mesmo e-mail em sessões diferentes: um destinatário só.
      { session: "r-1", origin: { recipientEmail: "Ana@Test.com " } },
      { session: "r-2", origin: { recipientEmail: "ana@test.com" } },
      // Sem e-mail, mesmo log de campanha: um destinatário só.
      { session: "r-3", origin: { emailLogId: "log-1" } },
      { session: "r-4", origin: { emailLogId: "log-1" } },
      // Sem e-mail nem log: cai na sessão.
      { session: "r-5", origin: {} },
      { session: "r-6", origin: {} },
    ]

    await prisma.publicFormMetricEvent.createMany({
      data: rows.map((row, index) => ({
        formId: scope.formId,
        publicationId: scope.publicationId,
        visitorSessionId: row.session,
        eventType: "form_started" as const,
        eventKey: `${scope.formId}:recipient:${index}`,
        origin: row.origin,
      })),
    })

    const persisted = await prisma.publicFormMetricEvent.findMany({
      where: { formId: scope.formId, eventType: "form_started" },
      select: { visitorSessionId: true, origin: true },
    })
    const expected = countUniqueFormMetricRecipients(persisted)

    const actual = await emailAnalyticsRepository.countFormEvents({
      teamId: scope.teamId,
      formId: scope.formId,
      eventType: "form_started",
      from: new Date(Date.now() - 60 * 60 * 1000),
      to: new Date(Date.now() + 60 * 60 * 1000),
    })

    expect(actual).toBe(expected)
    expect(actual).toBe(4)
  })

  it("T-M4.5 — o período filtra pelo occurredAt, não pelo dia do drain", async () => {
    /**
     * Regressão do achado do #1060: o UseCase e o backfill passaram a gravar
     * `occurredAt`, mas a agregação continuava filtrando por `createdAt` — o
     * campo era escrito e ninguém lia. Na prática o incidente 20–22/08 seguia
     * datando a conversão pelo dia do drain mesmo depois da correção.
     */
    const aceite = new Date("2026-08-20T22:10:31.000Z")
    const drain = new Date("2026-08-22T23:07:04.000Z")
    const eventKey = `${scope.formId}:drain:occurred-at`

    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: scope.formId } },
        publication: { connect: { id: scope.publicationId } },
        visitorSessionId: "s-drain",
        eventType: "form_completed",
        eventKey,
        occurredAt: aceite,
        createdAt: drain,
      },
    })

    const janelaDoAceite = await publicFormsRepository.countDistinctSessionsByEventType({
      formId: scope.formId,
      from: new Date("2026-08-20T00:00:00.000Z"),
      to: new Date("2026-08-21T00:00:00.000Z"),
    })
    const janelaDoDrain = await publicFormsRepository.countDistinctSessionsByEventType({
      formId: scope.formId,
      from: new Date("2026-08-22T00:00:00.000Z"),
      to: new Date("2026-08-23T00:00:00.000Z"),
    })

    expect(janelaDoAceite.form_completed).toBe(1)
    expect(janelaDoDrain.form_completed ?? 0).toBe(0)

    await prisma.publicFormMetricEvent.deleteMany({ where: { eventKey } })
  })

  it("T-M4.2 — 100 mil eventos: agregação responde em menos de 2s", async () => {
    const BATCH = 5_000
    const TOTAL = 100_000
    for (let offset = 0; offset < TOTAL; offset += BATCH) {
      await prisma.publicFormMetricEvent.createMany({
        data: Array.from({ length: BATCH }, (_, index) => {
          const seq = offset + index
          return {
            formId: scope.formId,
            publicationId: scope.publicationId,
            questionId: scope.questionId,
            questionSnapshot: {
              id: scope.questionId,
              title: "E-mail",
              position: 1,
              mappingKey: "email",
            },
            visitorSessionId: `scale-${seq % 10_000}`,
            eventType: "question_viewed" as const,
            eventKey: `${scope.formId}:scale:${seq}`,
          }
        }),
      })
    }

    const startedAt = performance.now()
    const grouped = await publicFormsRepository.groupMetricEvents({ formId: scope.formId })
    const elapsedMs = performance.now() - startedAt

    const viewed = grouped.find((row) => row.eventType === "question_viewed")
    expect(viewed?.uniqueSessions).toBe(10_000)
    expect(elapsedMs).toBeLessThan(2_000)
  }, 300_000)
})
