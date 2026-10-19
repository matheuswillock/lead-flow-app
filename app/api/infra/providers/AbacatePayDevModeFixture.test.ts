import { describe, expect, it } from "bun:test"
import { createAbacatePayDevModeFixture } from "./AbacatePayDevModeFixture"

describe("Abacate Pay Dev Mode fixture", () => {
  it("reproduces create, confirm, webhook, query, expiry and refund without production credentials", async () => {
    const fixture = createAbacatePayDevModeFixture()
    const created = await fixture.provider.createPixPayment({
      amountInCents: 1250,
      customer: {
        name: "Dev User",
        email: "dev@example.com",
        taxId: "12345678909",
        cellphone: "11999999999",
      },
      externalReference: "dev_attempt_1",
    })

    expect(created).toMatchObject({ status: "PENDING", method: "PIX", amountInCents: 1250 })
    if (created.status === "UNKNOWN") throw new Error("fixture unexpectedly indeterminate")

    fixture.confirm(created.externalId)
    const webhook = fixture.webhook(fixture.payments.get(created.externalId)!, "transparent.completed")
    expect(
      fixture.provider.normalizeEvent(
        fixture.provider.verifyRequest({
          rawBody: webhook.rawBody,
          signature: webhook.signature,
          query: { webhookSecret: "dev-webhook-secret" },
        }),
      ),
    ).toMatchObject({ event: "PAYMENT_CONFIRMED", status: "CONFIRMED" })
    await expect(fixture.provider.getStatus({ externalId: created.externalId, method: "PIX" })).resolves.toMatchObject({
      status: "CONFIRMED",
    })

    fixture.expire(created.externalId)
    await expect(fixture.provider.getStatus({ externalId: created.externalId, method: "PIX" })).resolves.toMatchObject({
      status: "EXPIRED",
    })
    await expect(fixture.provider.refundFull({ externalId: created.externalId })).resolves.toEqual({
      externalId: created.externalId,
      status: "REFUNDED",
    })
  })
})
