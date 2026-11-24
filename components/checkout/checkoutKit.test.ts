import { describe, expect, it } from "bun:test"

import { CheckoutMobilePayBar } from "./CheckoutMobilePayBar"
import { CheckoutOrderSummary } from "./CheckoutOrderSummary"
import { CheckoutPaymentMethod } from "./CheckoutPaymentMethod"
import { CheckoutPixPayment } from "./CheckoutPixPayment"
import { CheckoutSuccess } from "./CheckoutSuccess"

describe("kit de checkout", () => {
  it("exporta os componentes compartilhados como funções", () => {
    for (const component of [
      CheckoutPaymentMethod,
      CheckoutOrderSummary,
      CheckoutPixPayment,
      CheckoutSuccess,
      CheckoutMobilePayBar,
    ]) {
      expect(typeof component).toBe("function")
    }
  })

  it("o wrapper de PIX repassa as props para AdhesionPixPanel", () => {
    const props = {
      pix: { payload: "00020126", encodedImage: "", expirationDate: null },
      email: "cliente@example.com",
      now: 0,
      isExpired: false,
      isValidating: false,
      isRegenerating: false,
      onValidate: () => {},
      onRegenerate: () => {},
    } as unknown as Parameters<typeof CheckoutPixPayment>[0]

    const element = CheckoutPixPayment(props) as unknown as { props: Record<string, unknown> }

    expect(element.props).toEqual(props as unknown as Record<string, unknown>)
  })
})
