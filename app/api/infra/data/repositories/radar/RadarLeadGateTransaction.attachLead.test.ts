import { describe, expect, it, mock } from "bun:test"

/**
 * SPEC 40 E2 × modo radar — review #1051 (P2).
 *
 * O evento de progresso que move o gate C e o job da submissão vivem em filas
 * diferentes, sem ordem garantida. A submissão pode completar e emitir
 * `lead_discarded` **antes** de o gate anexar o lead: o gate depois conserta o
 * `leadId` da submissão, mas o evento de descarte ficava lá — sessão convertida
 * contada como descartada, o oposto do que o funil promete.
 *
 * A compensação vive dentro de `attachLeadToPendingSubmissions`, no mesmo
 * `transaction` do gate: ou o lead é anexado e o descarte some, ou nada
 * acontece. O teste entra pelo `execute`, que é o caminho público — assim
 * exercita a fiação real da unit of work, não uma classe exposta só para teste.
 */

mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }))

const { RadarLeadGateUnitOfWork } = await import("./RadarLeadGateUnitOfWork")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const SESSION = "sessao-radar-1"
const LEAD_ID = "lead-promovido"

function makeUnitOfWork(discardedRows = 1) {
  const submissionUpdateMany = mock(async () => ({ count: 1 }))
  const metricDeleteMany = mock(async () => ({ count: discardedRows }))
  const transaction = {
    $executeRaw: mock(async () => 1),
    publicFormSubmission: { updateMany: submissionUpdateMany },
    publicFormMetricEvent: { deleteMany: metricDeleteMany },
  }
  const database = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transaction),
  }
  return {
    unitOfWork: new RadarLeadGateUnitOfWork(database as never),
    submissionUpdateMany,
    metricDeleteMany,
  }
}

describe("attachLeadToPendingSubmissions — corrida do gate C", () => {
  it("anexa o lead e apaga o descarte que a corrida deixou para trás", async () => {
    const { unitOfWork, submissionUpdateMany, metricDeleteMany } = makeUnitOfWork()

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: "profile-1" }, (transaction) =>
      transaction.attachLeadToPendingSubmissions({
        formId: FORM_ID,
        visitorSessionId: SESSION,
        leadId: LEAD_ID,
      }),
    )

    expect(submissionUpdateMany).toHaveBeenCalledWith({
      where: { formId: FORM_ID, visitorSessionId: SESSION, leadId: null },
      data: { leadId: LEAD_ID },
    })
    // Escopado por form + sessão + tipo: não encosta em descarte de outra
    // sessão nem em outro evento do funil.
    expect(metricDeleteMany).toHaveBeenCalledWith({
      where: {
        formId: FORM_ID,
        visitorSessionId: SESSION,
        eventType: "lead_discarded",
      },
    })
  })

  it("é idempotente — sem descarte pendente, apaga zero linhas e segue", async () => {
    const { unitOfWork, metricDeleteMany } = makeUnitOfWork(0)

    await expect(
      unitOfWork.execute({ teamId: "team-1", radarProfileId: "profile-1" }, (transaction) =>
        transaction.attachLeadToPendingSubmissions({
          formId: FORM_ID,
          visitorSessionId: SESSION,
          leadId: LEAD_ID,
        }),
      ),
    ).resolves.toBeUndefined()

    expect(metricDeleteMany).toHaveBeenCalledTimes(1)
  })
})
