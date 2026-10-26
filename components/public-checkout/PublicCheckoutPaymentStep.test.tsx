import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import type { PublicCheckoutDetails, PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"
import { PublicCheckoutPaymentStep } from "./PublicCheckoutPaymentStep"

const details: PublicCheckoutDetails = {
  presetBillingType: "CREDIT_CARD",
  billingTypePrices: {
    PIX: { monthly: 100, total: 100 },
    CREDIT_CARD: { monthly: 100, total: 100 },
  },
  title: "t",
  subtitle: "s",
  includedTitle: "i",
  includedSubtitle: "is",
  compositionTitle: "c",
  compositionRows: [],
  invoiceItems: [],
  invoiceSummary: { monthlyTotal: 100, totalDueNow: 100, billingHint: "" },
  monthlyTotalLabel: "m",
  monthlyTotalValue: "v",
  totalTitle: "t",
  totalSubtitle: "s",
  totalValue: "v",
  totalHint: "h",
  startLabel: "a",
  startValue: "b",
  dueLabel: "c",
  dueValue: "d",
  issuedLabel: "e",
  issuedValue: "f",
}

const prefill: PublicCheckoutPayerPrefill = {
  fullName: "",
  email: "",
  phone: "",
  cpfCnpj: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
}

function render(props: { availableMethods?: ("PIX" | "CREDIT_CARD")[]; pixOnly?: boolean }) {
  return renderToStaticMarkup(
    <PublicCheckoutPaymentStep
      details={details}
      billingType="CREDIT_CARD"
      prefill={prefill}
      maxInstallments={12}
      isSubmitting={false}
      payment={null}
      onSubmit={async () => {}}
      {...props}
    />
  )
}

describe("PublicCheckoutPaymentStep card availability", () => {
  it("não renderiza cartão, parcelas nem CTA de cartão quando só PIX está disponível, mesmo com cartão solicitado", () => {
    for (const html of [render({}), render({ availableMethods: ["PIX"] }), render({ pixOnly: true })]) {
      expect(html).toContain("Gerar QR Code Pix")
      expect(html).not.toContain("Pagar com cartão")
      expect(html).not.toContain("Número do cartão")
      expect(html).not.toContain("Parcelas")
    }
  })

  it("renderiza o formulário de cartão apenas quando o cartão é declarado disponível", () => {
    const html = render({ availableMethods: ["PIX", "CREDIT_CARD"] })

    expect(html).toContain("Pagar com cartão")
    expect(html).toContain("Número do cartão")
    expect(html).toContain("Parcelas")
  })

  it("mantém a coleta de endereço nos fluxos legados que não usam pixOnly", () => {
    expect(render({ availableMethods: ["PIX"] })).toContain("CEP")
    expect(render({ pixOnly: true })).not.toContain("CEP")
  })
})
