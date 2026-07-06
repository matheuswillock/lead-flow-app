import { describe, expect, it, mock, beforeEach } from "bun:test"

const incrementMock = mock(async () => ({
  webhookConsecutiveFailures: 5,
  instanceName: "team_instance",
  phoneNumber: "5511999999999",
  status: "DISCONNECTED",
}))

const resetMock = mock(async () => {})

const captureMessageMock = mock(() => {})

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    incrementWebhookConsecutiveFailures: incrementMock,
    resetWebhookConsecutiveFailures: resetMock,
  },
}))

mock.module("@sentry/nextjs", () => ({
  withScope: (fn: (scope: {
    setLevel: typeof mock
    setFingerprint: typeof mock
    setTag: typeof mock
    setContext: typeof mock
  }) => void) => {
    fn({
      setLevel: mock(() => {}),
      setFingerprint: mock(() => {}),
      setTag: mock(() => {}),
      setContext: mock(() => {}),
    })
  },
  captureMessage: captureMessageMock,
}))

mock.module("@/lib/sentry/is-sentry-enabled", () => ({
  isSentryEnabled: () => true,
}))

const {
  getWhatsAppWebhookFailureAlertThreshold,
  recordWhatsAppWebhookProcessingFailure,
  recordWhatsAppWebhookProcessingSuccess,
} = await import("./whatsapp-webhook-failure-alert")

describe("whatsapp-webhook-failure-alert", () => {
  beforeEach(() => {
    incrementMock.mockClear()
    resetMock.mockClear()
    captureMessageMock.mockClear()
    delete process.env.WHATSAPP_WEBHOOK_FAILURE_ALERT_THRESHOLD
  })

  it("usa limiar padrão de 5 falhas", () => {
    expect(getWhatsAppWebhookFailureAlertThreshold()).toBe(5)
  })

  it("dispara alerta Sentry ao atingir o limiar", async () => {
    incrementMock.mockResolvedValueOnce({
      webhookConsecutiveFailures: 5,
      instanceName: "team_instance",
      phoneNumber: "5511999999999",
      status: "DISCONNECTED",
    })

    await recordWhatsAppWebhookProcessingFailure({
      configId: "config-1",
      teamId: "team-1",
      eventType: "messages.upsert",
      errors: ["DB timeout"],
    })

    expect(captureMessageMock).toHaveBeenCalledTimes(1)
  })

  it("não dispara alerta abaixo do limiar", async () => {
    incrementMock.mockResolvedValueOnce({
      webhookConsecutiveFailures: 3,
      instanceName: "team_instance",
      phoneNumber: null,
      status: "CONNECTED",
    })

    await recordWhatsAppWebhookProcessingFailure({
      configId: "config-1",
      teamId: "team-1",
      eventType: "messages.upsert",
    })

    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it("zera contador após sucesso", async () => {
    await recordWhatsAppWebhookProcessingSuccess("config-1")
    expect(resetMock).toHaveBeenCalledWith("config-1")
  })
})
