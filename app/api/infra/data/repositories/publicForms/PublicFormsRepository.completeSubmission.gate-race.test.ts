import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Prisma } from "@prisma/client"

/**
 * Review do PR #1107 (Codex P1). A conclusão da submissão e o gate do Radar
 * rodam em filas diferentes. `resolvedLeadId` é lido lá atrás, em
 * `processInBackground`; quando o gate reatribui a sessão para um card de
 * indicação no meio do caminho, esse valor vira o lead do DESTINATÁRIO —
 * velho. Gravá-lo desfaria a reatribuição do gate e ainda escreveria a
 * atividade rica (identidade + respostas) no card errado.
 *
 * A regra: a conclusão preenche o lead da submissão quando ele está vazio, e
 * nunca o rebaixa. O `update` desta transação já segura a linha, então a
 * releitura enxerga o que o gate comitou — ou o gate espera atrás e a
 * compensação dele resolve. Mesma filosofia da corrida do descarte (#1058).
 */

const submissionUpdate = mock(async () => ({}) as unknown)
const submissionFindUnique = mock(async () => ({ leadId: null }) as { leadId: string | null })
const submissionFindFirst = mock(async () => null as { id: string } | null)
const activityCreate = mock(async (_args: unknown) => ({}) as unknown)

const transactionClient = {
  publicFormSubmission: {
    update: submissionUpdate,
    findUnique: submissionFindUnique,
    findFirst: submissionFindFirst,
  },
  publicFormMetricEvent: { upsert: mock(async () => ({}) as unknown) },
  publicFormAnswer: {
    findMany: mock(async () => [] as unknown[]),
    deleteMany: mock(async () => ({ count: 0 })),
    createMany: mock(async () => ({ count: 0 })),
    update: mock(async () => ({}) as unknown),
  },
  leadActivity: { create: activityCreate },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transactionClient),
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SESSION = "sessao-alexandre"

function completeInput(leadId: string | null) {
  return {
    submissionId: "sub-1",
    leadId,
    processingAlerts: null,
    answers: [],
    activityBody: "Nova resposta de formulário — Alexandre",
    activityPayload: { kind: "public_form_completed" } as Prisma.InputJsonValue,
    metricEvents: [
      {
        formId: FORM_ID,
        publicationId: "pub-1",
        visitorSessionId: SESSION,
        eventType: "form_completed" as const,
        eventKey: `${SESSION}:form_completed`,
        origin: {} as Prisma.InputJsonValue,
      },
    ],
  }
}

function writtenLeadIds(): Array<string | null | undefined> {
  const calls = submissionUpdate.mock.calls as unknown as Array<
    [{ data: { leadId?: string | null } }]
  >
  return calls.map((call) => call[0].data.leadId)
}

function activityLeadId(): string | undefined {
  const calls = activityCreate.mock.calls as unknown as Array<[{ data: { leadId: string } }]>
  return calls[0]?.[0]?.data.leadId
}

describe("completeSubmission — corrida com a reatribuição do gate", () => {
  beforeEach(() => {
    submissionUpdate.mockClear()
    submissionFindUnique.mockClear()
    activityCreate.mockClear()
    submissionFindUnique.mockImplementation(async () => ({ leadId: null }))
  })

  it("não rebaixa a submissão para o lead velho quando o gate já reatribuiu", async () => {
    submissionFindUnique.mockImplementation(async () => ({ leadId: "lead-indicacao" }))

    await new PublicFormsRepository().completeSubmission(completeInput("lead-destinatario"))

    expect(writtenLeadIds()).not.toContain("lead-destinatario")
    // E a atividade com identidade e respostas nasce no card de indicação.
    expect(activityLeadId()).toBe("lead-indicacao")
  })

  it("preenche o lead quando a submissão ainda não tem nenhum", async () => {
    await new PublicFormsRepository().completeSubmission(completeInput("lead-destinatario"))

    expect(writtenLeadIds()).toContain("lead-destinatario")
    expect(activityLeadId()).toBe("lead-destinatario")
  })

  it("sem lead resolvido e sem lead na linha, não cria atividade", async () => {
    await new PublicFormsRepository().completeSubmission(completeInput(null))

    expect(activityCreate).not.toHaveBeenCalled()
  })
})
