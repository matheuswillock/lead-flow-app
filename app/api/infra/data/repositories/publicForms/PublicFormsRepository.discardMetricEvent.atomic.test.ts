import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

/**
 * SPEC 40 E2 × modo radar — review #1058, achado do Cursor.
 *
 * Conferir "a sessão tem lead?" e depois gravar o descarte, em chamadas
 * separadas, é check-then-act: entre a leitura e o upsert o gate C anexa o lead
 * e roda a compensação dele, e o upsert recria a linha recém-apagada. Aí não
 * sobra ninguém para apagar de novo — o descarte fica.
 *
 * A correção põe as duas coisas na mesma transação, com `FOR UPDATE` nas
 * submissões da sessão: as **mesmas linhas** que `attachLeadToPendingSubmissions`
 * atualiza. Isso serializa os dois lados no lock do Postgres — ou este consumer
 * segura e o gate espera (e a compensação dele apaga o que gravamos), ou o gate
 * comita primeiro e nós lemos o lead e não gravamos.
 */

const queryRaw = mock(
  async (..._args: unknown[]) => [] as Array<{ leadId: string | null }>,
)
const metricUpsert = mock(async (_args: unknown) => ({}) as unknown)

const transactionClient = {
  $queryRaw: queryRaw,
  publicFormMetricEvent: { upsert: metricUpsert },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transactionClient),
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SESSION = "sessao-radar-1"

function discardInput() {
  return {
    formId: FORM_ID,
    publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    visitorSessionId: SESSION,
    eventKey: `${SESSION}:lead_discarded`,
    origin: {} as Prisma.InputJsonValue,
  }
}

describe("upsertDiscardMetricEventWhenSessionHasNoLead", () => {
  beforeEach(() => {
    queryRaw.mockClear()
    metricUpsert.mockClear()
    queryRaw.mockImplementation(async () => [])
  })

  it("grava quando nenhuma submissão da sessão tem lead", async () => {
    queryRaw.mockImplementation(async () => [{ leadId: null }, { leadId: null }])

    const persisted = await new PublicFormsRepository().upsertDiscardMetricEventWhenSessionHasNoLead(
      discardInput(),
    )

    expect(persisted).toBe(true)
    expect(metricUpsert).toHaveBeenCalledTimes(1)
  })

  it("não grava quando qualquer submissão da sessão já tem lead", async () => {
    queryRaw.mockImplementation(async () => [{ leadId: null }, { leadId: "lead-promovido" }])

    const persisted = await new PublicFormsRepository().upsertDiscardMetricEventWhenSessionHasNoLead(
      discardInput(),
    )

    expect(persisted).toBe(false)
    expect(metricUpsert).not.toHaveBeenCalled()
  })

  it("trava as linhas antes de decidir — a leitura solta não vale nada", async () => {
    await new PublicFormsRepository().upsertDiscardMetricEventWhenSessionHasNoLead(discardInput())

    // O `FOR UPDATE` é o mecanismo inteiro: sem ele a consulta continua sendo
    // check-then-act, só que dentro de uma transação — a corrida volta igual.
    const sql = queryRaw.mock.calls[0]?.[0] as unknown as { strings?: string[] } | string[]
    const text = (Array.isArray(sql) ? sql.join("?") : (sql?.strings ?? []).join("?")).toUpperCase()
    expect(text).toContain("FOR UPDATE")
    // Nome físico do `@@map`, não o nome do model: SQL cru não passa pelo Prisma.
    expect(text).toContain("CORRETOR_STUDIO_PUBLIC_FORM_SUBMISSIONS")
    // Mesmo escopo do `attachLeadToPendingSubmissions` — escopo divergente
    // travaria linhas diferentes das que o gate atualiza, e a serialização não
    // aconteceria.
    expect(text).toContain('"FORMID"')
    expect(text).toContain('"VISITORSESSIONID"')
  })

  it("é idempotente na reentrega da fila — upsert first-write-wins", async () => {
    const repository = new PublicFormsRepository()
    await repository.upsertDiscardMetricEventWhenSessionHasNoLead(discardInput())
    await repository.upsertDiscardMetricEventWhenSessionHasNoLead(discardInput())

    expect(metricUpsert).toHaveBeenCalledTimes(2)
    for (const call of metricUpsert.mock.calls) {
      const args = call[0] as { where: { eventKey: string }; update: Record<string, never> }
      expect(args.where).toEqual({ eventKey: `${SESSION}:lead_discarded` })
      expect(args.update).toEqual({})
    }
  })
})
