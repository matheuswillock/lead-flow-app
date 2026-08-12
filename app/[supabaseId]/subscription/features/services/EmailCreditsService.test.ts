import { afterEach, describe, expect, it, mock } from "bun:test"
import { resolveCheckoutNavigationPath } from "../utils/emailCreditsTabVisibility"

describe("EmailCreditsService.subscribe (T05)", () => {
  afterEach(() => {
    mock.restore()
  })

  it("T05: cria checkout e retorna checkoutUrl para /addon-checkout/[id]", async () => {
    const fetchMock = mock(async () =>
      Response.json({
        isValid: true,
        successMessages: [],
        errorMessages: [],
        result: {
          checkoutId: "purchase-1",
          checkoutUrl: "https://app.local/addon-checkout/purchase-1",
          externalReference: "platform-purchase-purchase-1",
          status: "pending",
          plan: "plus",
          monthlyCredits: 5000,
          pricePerMonth: 100,
          teamId: "team-1",
          subscriptionActivated: false,
        },
      })
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { emailCreditsService } = await import("./EmailCreditsService")
    const result = await emailCreditsService.subscribe("plus")

    expect(result.checkoutUrl).toContain("/addon-checkout/purchase-1")
    expect(result.subscriptionActivated).toBe(false)
    expect(resolveCheckoutNavigationPath(result.checkoutUrl)).toBe(
      "/addon-checkout/purchase-1"
    )
    expect(fetchMock).toHaveBeenCalled()
  })
})
