import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"

/**
 * SPEC 40 E2 × modo radar — review #1058, última janela.
 *
 * O descarte é gravado por dois caminhos independentes: a transação de
 * `completeSubmission` e, depois, a mensagem publicada na fila de métricas —
 * consumida noutro processo, sem ordem garantida contra o gate C. Guardar só a
 * transação deixava a mensagem em voo **ressuscitar** a linha que a compensação
 * do gate tinha acabado de apagar.
 *
 * Aqui o serviço não confere-e-grava: delega ao repositório, que faz as duas
 * coisas na mesma transação com `FOR UPDATE`. Conferir aqui e gravar lá seria
 * check-then-act, e o gate cabe na fresta entre as duas chamadas — foi
 * exatamente o que o review apontou na primeira tentativa desta correção.
 */

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const SESSION = "session_abcdefghij"

const findPublishedByPublicId = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot: { formId: FORM_ID, questions: [] as Array<{ id: string }> },
}))
const findAvailabilityTeamContext = mock(async () => null)
const upsertMetricEvent = mock(async () => {})
const upsertDiscardWhenNoLead = mock(async (..._args: unknown[]) => true)

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findPublishedByPublicId,
    findAvailabilityTeamContext,
    upsertMetricEvent,
    upsertDiscardMetricEventWhenSessionHasNoLead: upsertDiscardWhenNoLead,
  },
}))

mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: {
    execute: mock(async () => new Output(true, [], [], null)),
  },
}))

const { PublicFormsService } = await import("./PublicFormsService")

function metric(eventType: PublicFormMetricEventInput["eventType"]): PublicFormMetricEventInput {
  return {
    visitorSessionId: SESSION,
    eventType,
    eventKey: `${SESSION}:${eventType}`,
    origin: {},
  }
}

describe("recordMetric — descarte × corrida do gate C", () => {
  const service = new PublicFormsService()

  beforeEach(() => {
    upsertMetricEvent.mockClear()
    upsertDiscardWhenNoLead.mockClear()
    upsertDiscardWhenNoLead.mockImplementation(async () => true)
  })

  it("acka sem erro quando o repositório recusa o descarte por lead anexado", async () => {
    upsertDiscardWhenNoLead.mockImplementation(async () => false)

    const accepted = await service.recordMetric(PUBLIC_ID, metric("lead_discarded"), {
      radarMode: "skip",
    })

    // `true`, não `false`: o evento ficou obsoleto, não é erro. `false` faria o
    // consumer logar "formulário indisponível" e mascarar o motivo real.
    expect(accepted).toBe(true)
  })

  it("descarte nunca passa pelo upsert solto — só pelo caminho transacional", async () => {
    await service.recordMetric(PUBLIC_ID, metric("lead_discarded"), { radarMode: "skip" })

    // `upsertMetricEvent` grava sem travar as submissões da sessão. Um descarte
    // por ali seria check-then-act de novo, com a corrida de volta.
    expect(upsertMetricEvent).not.toHaveBeenCalled()
    expect(upsertDiscardWhenNoLead).toHaveBeenCalledTimes(1)
  })

  it("os outros eventos continuam pelo upsert comum", async () => {
    await service.recordMetric(PUBLIC_ID, metric("form_completed"), { radarMode: "skip" })

    expect(upsertDiscardWhenNoLead).not.toHaveBeenCalled()
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
  })

  it("delega com o escopo que o gate usa para anexar — form e sessão", async () => {
    await service.recordMetric(PUBLIC_ID, metric("lead_discarded"), { radarMode: "skip" })

    const args = upsertDiscardWhenNoLead.mock.calls[0]?.[0] as unknown as {
      formId: string
      visitorSessionId: string
      eventKey: string
    }
    expect(args.formId).toBe(FORM_ID)
    expect(args.visitorSessionId).toBe(SESSION)
    expect(args.eventKey).toBe(`${SESSION}:lead_discarded`)
  })
})
