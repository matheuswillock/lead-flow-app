import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"

/**
 * SPEC 40 E2 × modo radar — review #1058 (P1), terceira janela.
 *
 * O descarte é gravado duas vezes por caminhos independentes: na transação de
 * `completeSubmission` e, depois, pela mensagem publicada na fila de métricas —
 * consumida noutro processo, sem ordem garantida contra o gate C. Guardar só a
 * transação deixava a mensagem em voo **ressuscitar** a linha que a compensação
 * do gate tinha acabado de apagar: o descarte reaparecia minutos depois, agora
 * sem nenhum lado para apagá-lo de novo.
 *
 * Mesmo fato dos outros dois pontos de escrita — sessão com lead anexado — para
 * que os três convirjam em vez de cada um decidir por conta.
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
const hasLeadAttachedToSession = mock(async () => false)

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findPublishedByPublicId,
    findAvailabilityTeamContext,
    upsertMetricEvent,
    hasLeadAttachedToSession,
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
    hasLeadAttachedToSession.mockClear()
    hasLeadAttachedToSession.mockImplementation(async () => false)
  })

  it("não persiste lead_discarded da fila quando a sessão já tem lead", async () => {
    hasLeadAttachedToSession.mockImplementation(async () => true)

    const accepted = await service.recordMetric(PUBLIC_ID, metric("lead_discarded"), {
      radarMode: "skip",
    })

    // `true`, não `false`: o evento ficou obsoleto, não é erro. `false` faria o
    // consumer logar "formulário indisponível" e mascarar o motivo real.
    expect(accepted).toBe(true)
    expect(upsertMetricEvent).not.toHaveBeenCalled()
  })

  it("persiste lead_discarded quando a sessão de fato não converteu", async () => {
    const accepted = await service.recordMetric(PUBLIC_ID, metric("lead_discarded"), {
      radarMode: "skip",
    })

    expect(accepted).toBe(true)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
  })

  it("não consulta o lead para eventos que não são descarte", async () => {
    await service.recordMetric(PUBLIC_ID, metric("form_completed"), { radarMode: "skip" })

    expect(hasLeadAttachedToSession).not.toHaveBeenCalled()
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
  })

  it("consulta pelo mesmo escopo do gate — form e sessão", async () => {
    await service.recordMetric(PUBLIC_ID, metric("lead_discarded"), { radarMode: "skip" })

    expect(hasLeadAttachedToSession).toHaveBeenCalledWith(FORM_ID, SESSION)
  })
})
