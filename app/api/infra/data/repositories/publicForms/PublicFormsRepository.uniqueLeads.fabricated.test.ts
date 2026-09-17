import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * SPEC 40, todo 23 — review #1070 (P1).
 *
 * `uniqueLeads` e `leadCreatedSessions` moram no MESMO card do funil ("Leads
 * vinculados") mas vêm de fontes diferentes: este conta submissões, aquele conta
 * eventos de métrica. Com o corte das fabricadas só nos eventos, os 21 leads
 * criados a partir de submissões fabricadas sumiriam de um número e continuariam
 * no outro.
 *
 * Dois valores brigando na mesma tela é pior que os dois errados juntos: não há
 * como o dono saber qual conferir.
 */

const submissionFindMany = mock(async (_args: unknown) => [] as unknown[])

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { publicFormSubmission: { findMany: submissionFindMany } },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

describe("countDistinctCompletedLeads — fabricadas fora do total", () => {
  beforeEach(() => {
    submissionFindMany.mockClear()
  })

  it("não conta o lead cuja submissão foi fabricada pelo cron", async () => {
    submissionFindMany.mockImplementation(async () => [
      { leadId: "lead-real", origin: {} },
      { leadId: "lead-de-casca", origin: { fabricatedByDispatcher: true } },
    ])

    const total = await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    expect(total).toBe(1)
  })

  it("sem marca nenhuma, o total é o de antes", async () => {
    submissionFindMany.mockImplementation(async () => [
      { leadId: "lead-1", origin: {} },
      { leadId: "lead-2", origin: { campaignId: "c1" } },
    ])

    const total = await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    expect(total).toBe(2)
  })

  it("carrega o origin na consulta — sem ele o corte não teria como acontecer", async () => {
    await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    const args = submissionFindMany.mock.calls[0]?.[0] as unknown as {
      select: Record<string, boolean>
      distinct?: string[]
    }
    expect(args.select.origin).toBe(true)
  })

  it("continua contando o mesmo lead uma vez só — 'único' não mudou", async () => {
    submissionFindMany.mockImplementation(async () => [
      { leadId: "lead-1", origin: {} },
      { leadId: "lead-1", origin: {} },
    ])

    const total = await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    expect(total).toBe(1)
  })

  /**
   * Segundo review do #1070 (Cursor). O `distinct: ["leadId"]` deduplicava
   * **antes** deste filtro: para um lead com submissão fabricada E submissão
   * real, o banco devolvia uma linha só, arbitrária. Caindo a fabricada, o lead
   * legítimo sumia da conta — erro no sentido **oposto** ao do bug original, e
   * exatamente nas sessões mistas que o PR quis preservar.
   *
   * Medido em produção: 2 leads nessa situação. Este teste trava a ordem
   * "filtra, depois deduplica".
   */
  it("mesmo lead com submissão fabricada E real continua contando — a real manda", async () => {
    submissionFindMany.mockImplementation(async () => [
      { leadId: "lead-misto", origin: { fabricatedByDispatcher: true } },
      { leadId: "lead-misto", origin: {} },
    ])

    const total = await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    expect(total).toBe(1)
  })

  it("a ordem das linhas não muda o resultado — fabricada primeiro ou depois", async () => {
    submissionFindMany.mockImplementation(async () => [
      { leadId: "lead-misto", origin: {} },
      { leadId: "lead-misto", origin: { fabricatedByDispatcher: true } },
    ])

    const total = await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    expect(total).toBe(1)
  })

  it("não deduplica antes de filtrar — a query não pode pedir distinct", async () => {
    await new PublicFormsRepository().countDistinctCompletedLeads(FORM_ID)

    const args = submissionFindMany.mock.calls[0]?.[0] as unknown as { distinct?: string[] }
    // Se voltar, a dedupe volta a acontecer no banco, antes do filtro, e o bug
    // do lead misto volta junto — sem nenhum teste falhando por outro caminho.
    expect(args.distinct).toBeUndefined()
  })
})
