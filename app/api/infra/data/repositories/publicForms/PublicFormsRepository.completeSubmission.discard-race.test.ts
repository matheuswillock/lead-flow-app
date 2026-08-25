import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Prisma } from "@prisma/client"

/**
 * SPEC 40 E2 × modo radar — review #1058 (P1).
 *
 * A compensação por `deleteMany` no gate C (review #1051) fechava **uma** das
 * duas ordens possíveis: descarte gravado, gate depois. A outra ficou aberta —
 * o gate anexa o lead enquanto `processInBackground` já decidiu emitir
 * `lead_discarded`, e o `deleteMany` apaga zero linhas porque a gravação ainda
 * não aconteceu. Segundos depois a submissão grava o descarte de uma sessão que
 * converteu.
 *
 * A correção reavalia o fato dentro da transação de `completeSubmission`: o
 * `update` da submissão já segurou a linha, então a leitura enxerga o que o gate
 * comitou — ou o gate espera atrás e a compensação dele resolve. Um dos dois
 * lados sempre ganha.
 *
 * O teste exercita a transação real do repositório com um `$transaction` falso,
 * não um espelho da lógica nos mocks: o que se quer provar é que o `upsert` do
 * descarte **não acontece**, e isso só é observável no client.
 */

const submissionUpdate = mock(async () => ({}) as unknown)
const submissionFindFirst = mock(async () => null as { id: string } | null)
const metricUpsert = mock(async (_args: unknown) => ({}) as unknown)
const answerFindMany = mock(async () => [] as unknown[])
const answerDeleteMany = mock(async () => ({ count: 0 }))

const transactionClient = {
  publicFormSubmission: { update: submissionUpdate, findFirst: submissionFindFirst },
  publicFormMetricEvent: { upsert: metricUpsert },
  publicFormAnswer: {
    findMany: answerFindMany,
    deleteMany: answerDeleteMany,
    createMany: mock(async () => ({ count: 0 })),
    update: mock(async () => ({}) as unknown),
  },
  leadActivity: { create: mock(async () => ({}) as unknown) },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transactionClient),
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SESSION = "sessao-radar-1"

function completeInput() {
  return {
    submissionId: "sub-1",
    leadId: null,
    processingAlerts: null,
    answers: [],
    metricEvents: [
      {
        formId: FORM_ID,
        publicationId: "pub-1",
        visitorSessionId: SESSION,
        eventType: "form_completed" as const,
        eventKey: `${SESSION}:form_completed`,
        origin: {} as Prisma.InputJsonValue,
      },
      {
        formId: FORM_ID,
        publicationId: "pub-1",
        visitorSessionId: SESSION,
        eventType: "lead_discarded" as const,
        eventKey: `${SESSION}:lead_discarded`,
        origin: {} as Prisma.InputJsonValue,
      },
    ],
  }
}

function persistedEventTypes() {
  return metricUpsert.mock.calls.map(
    (call) => (call[0] as { create: { eventType: string } }).create.eventType,
  )
}

describe("completeSubmission — descarte × corrida do gate C", () => {
  beforeEach(() => {
    submissionUpdate.mockClear()
    submissionFindFirst.mockClear()
    metricUpsert.mockClear()
    answerFindMany.mockClear()
    submissionFindFirst.mockImplementation(async () => null)
  })

  it("não grava lead_discarded quando o gate já anexou o lead na sessão", async () => {
    submissionFindFirst.mockImplementation(async () => ({ id: "sub-1" }))

    await new PublicFormsRepository().completeSubmission(completeInput())

    expect(persistedEventTypes()).toEqual(["form_completed"])
  })

  it("grava lead_discarded quando a sessão realmente não tem lead", async () => {
    await new PublicFormsRepository().completeSubmission(completeInput())

    expect(persistedEventTypes()).toEqual(["form_completed", "lead_discarded"])
  })

  it("consulta o lead pelo mesmo escopo que o gate usa para anexar", async () => {
    await new PublicFormsRepository().completeSubmission(completeInput())

    // Form + sessão, igual ao `attachLeadToPendingSubmissions`. Escopo diferente
    // dos dois lados faria a compensação e o guard falarem de conjuntos
    // distintos de linhas — e a corrida voltaria por outro caminho.
    expect(submissionFindFirst).toHaveBeenCalledWith({
      where: { formId: FORM_ID, visitorSessionId: SESSION, leadId: { not: null } },
      select: { id: true },
    })
  })

  it("não consulta nada quando o lote não tem descarte", async () => {
    const input = completeInput()
    input.metricEvents = input.metricEvents.filter((event) => event.eventType !== "lead_discarded")

    await new PublicFormsRepository().completeSubmission(input)

    expect(submissionFindFirst).not.toHaveBeenCalled()
    expect(persistedEventTypes()).toEqual(["form_completed"])
  })

  /**
   * Review #1058, achado do Cursor: a transação derrubava o descarte, mas o
   * use case enfileirava o lote **original** — o consumer regravava por fora o
   * evento que a transação tinha acabado de recusar. Devolver o lote persistido
   * é o que fecha esse desvio: quem publica não tem como divergir de quem
   * gravou.
   */
  it("devolve o lote persistido, para o caller enfileirar só o que gravou", async () => {
    submissionFindFirst.mockImplementation(async () => ({ id: "sub-1" }))

    const persisted = await new PublicFormsRepository().completeSubmission(completeInput())

    expect(persisted.map((event) => event.eventType)).toEqual(["form_completed"])
  })

  it("devolve o lote inteiro quando nada foi derrubado", async () => {
    const persisted = await new PublicFormsRepository().completeSubmission(completeInput())

    expect(persisted.map((event) => event.eventType)).toEqual([
      "form_completed",
      "lead_discarded",
    ])
  })
})
