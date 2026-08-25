import { describe, expect, it } from "bun:test"
import {
  buildPublicFormIdentityGateIdempotencyKey,
  buildPublicFormMetricEventKey,
  buildPublicFormQuestionAnsweredEventKey,
  buildPublicFormServerValidationFailedEventKey,
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

  it("escopa a recusa de servidor por formulário e publicação", () => {
    const formA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const formB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const publicacao1 = "11111111-1111-4111-8111-111111111111"
    const publicacao2 = "22222222-2222-4222-8222-222222222222"

    expect(buildPublicFormServerValidationFailedEventKey(formA, publicacao1, "session-a")).toBe(
      `session-a:form_validation_failed:server:${formA}:${publicacao1}`,
    )

    // eventKey é @unique global e o upsert é first-write-wins: sem o formId, a
    // recusa no form A ocupa a chave e a do form B vira no-op (review #1030).
    expect(
      buildPublicFormServerValidationFailedEventKey(formB, publicacao1, "session-a"),
    ).not.toBe(buildPublicFormServerValidationFailedEventKey(formA, publicacao1, "session-a"))

    // Mesma sessão falhando antes e depois de uma republicação: o evento é
    // atribuído à publicação nova, então a chave precisa mudar junto — senão o
    // funil filtrado por publicação perde a segunda recusa (review #1051).
    expect(
      buildPublicFormServerValidationFailedEventKey(formA, publicacao2, "session-a"),
    ).not.toBe(buildPublicFormServerValidationFailedEventKey(formA, publicacao1, "session-a"))

    // Martelar o mesmo endpoint na mesma publicação continua contando 1 sessão.
    expect(buildPublicFormServerValidationFailedEventKey(formA, publicacao1, "session-a")).toBe(
      buildPublicFormServerValidationFailedEventKey(formA, publicacao1, "session-a"),
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
