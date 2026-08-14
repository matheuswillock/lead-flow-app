import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { RadarEmailContactSyncWakePayload } from "@/lib/queues/radar-email-contact-sync"
import { Output } from "@/lib/output"

mock.module("@/lib/queues/radar-email-contact-sync", () => ({
  handleRadarEmailContactSyncCallback: (handler: unknown) => handler,
}))

const { processRadarEmailContactSyncWakeMessage } = await import("./route")

const execute = mock(async () => new Output(true, [], [], { claimed: 3 }))

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "radar-email-contact-sync",
  region: "gru1",
}

describe("processRadarEmailContactSyncWakeMessage", () => {
  beforeEach(() => {
    execute.mockReset()
    execute.mockResolvedValue(new Output(true, [], [], { claimed: 3 }))
  })

  it("chama execute com source=queue", async () => {
    await processRadarEmailContactSyncWakeMessage({ reason: "outbox_due" }, metadata, {
      execute,
    })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({ source: "queue" })
  })

  it("payload inválido: ack sem chamar execute", async () => {
    await processRadarEmailContactSyncWakeMessage(
      { reason: "nope" } as unknown as RadarEmailContactSyncWakePayload,
      metadata,
      { execute }
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("Output inválido: throw para retry", async () => {
    execute.mockResolvedValueOnce(new Output(false, [], ["Erro ao processar outbox de sync Radar"], null))
    await expect(
      processRadarEmailContactSyncWakeMessage({ reason: "outbox_due" }, metadata, { execute })
    ).rejects.toThrow("Erro ao processar outbox de sync Radar")
  })
})
