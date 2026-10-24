import { describe, expect, it, mock } from "bun:test"
import { reportPaymentDisputed } from "./reportPaymentDisputed"

describe("reportPaymentDisputed (PAY-HARD-T019)", () => {
  it("alerta Sentry e Slack com o id da cobrança, sem pedir reembolso", async () => {
    const alert = mock(async (_input: unknown) => undefined)

    await reportPaymentDisputed(
      { attemptId: "att-1", ownerType: "PLATFORM_PURCHASE", ownerId: "p-1", chargeId: "pix_char_1", eventId: "evt_1" },
      { alert },
    )

    expect(alert).toHaveBeenCalledTimes(1)
    const sent = alert.mock.calls[0]?.[0] as { key: string; level: string; slack: boolean; message: string; context: Record<string, unknown> }
    expect(sent).toMatchObject({ key: "payment-disputed", level: "error", slack: true })
    expect(sent.message).toContain("pix_char_1")
    expect(sent.context).toMatchObject({ chargeId: "pix_char_1", attemptId: "att-1" })
  })
})
