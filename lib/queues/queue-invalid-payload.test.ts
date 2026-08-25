import { describe, expect, it, mock } from "bun:test"
import {
  buildInvalidPayloadDeadLetterInput,
  buildInvalidPayloadIdempotencyKey,
  deadLetterInvalidPayload,
  describeMissingRequiredFields,
  listMissingRequiredFields,
  QUEUE_FAILURE_REASON_INVALID_PAYLOAD,
} from "./queue-invalid-payload"

describe("buildInvalidPayloadIdempotencyKey", () => {
  it("usa a chave do payload quando ela existe", () => {
    expect(buildInvalidPayloadIdempotencyKey("evt-1", "msg-1")).toBe("evt-1")
  })

  it("cai no messageId quando a chave falta, é vazia ou só tem espaço", () => {
    expect(buildInvalidPayloadIdempotencyKey(undefined, "msg-1")).toBe("invalid_payload:msg-1")
    expect(buildInvalidPayloadIdempotencyKey(null, "msg-1")).toBe("invalid_payload:msg-1")
    expect(buildInvalidPayloadIdempotencyKey("", "msg-1")).toBe("invalid_payload:msg-1")
    expect(buildInvalidPayloadIdempotencyKey("   ", "msg-1")).toBe("invalid_payload:msg-1")
  })
})

describe("buildInvalidPayloadDeadLetterInput", () => {
  it("força a gravação no outbox já na primeira entrega", () => {
    const input = buildInvalidPayloadDeadLetterInput({
      topic: "public-form-metric-events",
      idempotencyKeyCandidate: "evt-1",
      messageId: "msg-1",
      payload: { eventKey: "evt-1" },
      detail: "publicId ausente",
    })

    expect(input.deliveryCount).toBeGreaterThanOrEqual(input.maxDeliveryCount ?? 0)
    expect(input.maxDeliveryCount).toBe(1)
    expect(input).toEqual({
      deliveryCount: 1,
      maxDeliveryCount: 1,
      topic: "public-form-metric-events",
      idempotencyKey: "evt-1",
      payload: { eventKey: "evt-1" },
      lastError: `${QUEUE_FAILURE_REASON_INVALID_PAYLOAD}: publicId ausente`,
    })
  })

  it("mantém o motivo consultável como prefixo do lastError", () => {
    const input = buildInvalidPayloadDeadLetterInput({
      topic: "asaas-webhook-events",
      idempotencyKeyCandidate: null,
      messageId: "msg-9",
      payload: null,
      detail: "eventId ausente",
    })

    expect(input.lastError).toMatch(/^invalid_payload: /)
    expect(input.idempotencyKey).toBe("invalid_payload:msg-9")
  })
})

describe("listMissingRequiredFields", () => {
  it("lista só os campos vazios, na ordem declarada", () => {
    expect(
      listMissingRequiredFields({
        publicId: "pub-1",
        eventKey: "",
        visitorSessionId: undefined,
        eventType: null,
      }),
    ).toEqual(["eventKey", "visitorSessionId", "eventType"])
  })

  it("devolve vazio quando tudo está preenchido", () => {
    expect(listMissingRequiredFields({ a: "x", b: 1, c: {} })).toEqual([])
  })

  it("descreve os campos ausentes de forma legível", () => {
    expect(describeMissingRequiredFields(["publicId", "eventKey"])).toBe(
      "campos obrigatórios ausentes: publicId, eventKey",
    )
  })
})

describe("deadLetterInvalidPayload", () => {
  it("grava no outbox antes do ack", async () => {
    const ack = mock(async () => true)

    await deadLetterInvalidPayload(
      {
        topic: "public-form-progress-events",
        idempotencyKeyCandidate: "prog-1",
        messageId: "msg-2",
        payload: { publicId: null },
        detail: "campos obrigatórios ausentes: publicId",
      },
      ack,
    )

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-progress-events",
        idempotencyKey: "prog-1",
        maxDeliveryCount: 1,
        lastError: "invalid_payload: campos obrigatórios ausentes: publicId",
      }),
    )
  })

  it("não propaga falha da escrita — payload inválido nunca volta para a fila", async () => {
    const ack = mock(async () => {
      throw new Error("outbox indisponível")
    })

    await deadLetterInvalidPayload(
      {
        topic: "asaas-webhook-events",
        idempotencyKeyCandidate: null,
        messageId: "msg-3",
        payload: {},
        detail: "eventId ausente",
      },
      ack,
    )

    expect(ack).toHaveBeenCalledTimes(1)
  })
})
