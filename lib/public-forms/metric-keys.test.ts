import { describe, expect, it } from "bun:test"
import {
  buildPublicFormIdentityGateIdempotencyKey,
  buildPublicFormMetricEventKey,
  buildPublicFormQuestionAnsweredEventKey,
  buildPublicFormSubmitRequestKey,
} from "@/lib/public-forms/metric-keys"

describe("public form metric keys", () => {
  it("gera requestKey estável por sessão", () => {
    expect(buildPublicFormSubmitRequestKey("session-a")).toBe("session-a:submit")
    expect(buildPublicFormSubmitRequestKey("session-a")).toBe(
      buildPublicFormSubmitRequestKey("session-a"),
    )
  })

  it("escopa o requestKey por atribuição — segunda campanha não bate no curto-circuito", () => {
    const campanhaA = "e231d889-da04-4273-afb2-c2e82fa9a04e"
    const campanhaB = "3fc5f0a2-1111-4222-8333-444455556666"

    expect(buildPublicFormSubmitRequestKey("session-a", campanhaA)).toBe(
      `session-a:submit:el:${campanhaA}`,
    )

    // requestKey é @unique e o accept() devolve "Respostas já recebidas" quando
    // acha submissão completa com a mesma chave. Sem escopo, a conversão da
    // segunda campanha nunca nasce e nenhuma métrica é gerada.
    expect(buildPublicFormSubmitRequestKey("session-a", campanhaB)).not.toBe(
      buildPublicFormSubmitRequestKey("session-a", campanhaA),
    )

    // Reenviar pelo MESMO link continua idempotente.
    expect(buildPublicFormSubmitRequestKey("session-a", campanhaA)).toBe(
      buildPublicFormSubmitRequestKey("session-a", campanhaA),
    )

    // Visita direta mantém a chave antiga; valor forjado é ignorado.
    expect(buildPublicFormSubmitRequestKey("session-a", null)).toBe("session-a:submit")
    expect(buildPublicFormSubmitRequestKey("session-a", "nao-e-uuid")).toBe("session-a:submit")
  })

  it("gera eventKey estável por sessão e tipo", () => {
    expect(buildPublicFormMetricEventKey("session-a", "form_completed")).toBe(
      "session-a:form_completed",
    )
    expect(buildPublicFormMetricEventKey("session-a", "lead_attached")).toBe(
      "session-a:lead_attached",
    )
    expect(buildPublicFormMetricEventKey("session-a", "form_completed")).toBe(
      buildPublicFormMetricEventKey("session-a", "form_completed"),
    )
  })

  it("escopa o eventKey por atribuição quando há emailLogId", () => {
    const emailLogId = "e231d889-da04-4273-afb2-c2e82fa9a04e"
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", emailLogId)).toBe(
      `session-a:form_completed:el:${emailLogId}`,
    )

    // Duas campanhas para o mesmo destinatário não podem colidir: sem o escopo,
    // o upsert first-write-wins credita a conversão nova à campanha antiga.
    const outroDisparo = "3fc5f0a2-1111-4222-8333-444455556666"
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", outroDisparo)).not.toBe(
      buildPublicFormMetricEventKey("session-a", "form_completed", emailLogId),
    )

    // Recarregar a mesma visita atribuída continua colapsando na mesma linha.
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", emailLogId)).toBe(
      buildPublicFormMetricEventKey("session-a", "form_completed", emailLogId),
    )
  })

  it("mantém a chave antiga em visita direta e ignora emailLogId inválido", () => {
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", null)).toBe(
      "session-a:form_completed",
    )
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", undefined)).toBe(
      "session-a:form_completed",
    )
    // Não-UUID não pode entrar na chave — permitiria forjar linha e furar o dedupe.
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", "nao-e-uuid")).toBe(
      "session-a:form_completed",
    )
    expect(buildPublicFormMetricEventKey("session-a", "form_completed", "   ")).toBe(
      "session-a:form_completed",
    )
  })

  it("gera eventKey unificado de question_answered (funil = Radar)", () => {
    expect(buildPublicFormQuestionAnsweredEventKey("session-a", "qid-1")).toBe(
      "session-a:question_answered:qid-1",
    )
  })

  it("decoupla a reavaliação A+C do eventKey estável da métrica", () => {
    const eventKey = buildPublicFormQuestionAnsweredEventKey("session-a", "qid-1")
    const first = buildPublicFormIdentityGateIdempotencyKey(eventKey, "119")
    const corrected = buildPublicFormIdentityGateIdempotencyKey(eventKey, "(11) 98888-7777")
    expect(first).toMatch(new RegExp(`^${eventKey}:rev:[a-f0-9]{16}$`))
    expect(corrected).toMatch(new RegExp(`^${eventKey}:rev:[a-f0-9]{16}$`))
    expect(first).not.toBe(corrected)
    expect(buildPublicFormIdentityGateIdempotencyKey(eventKey, "119")).toBe(first)
  })
})
