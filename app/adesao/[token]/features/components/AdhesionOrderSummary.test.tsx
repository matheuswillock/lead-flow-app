import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import { buildAdhesionPaymentSummary } from "../utils/adhesionPayment"
import type { PublicAdhesionDetails } from "../context/PublicAdhesionTypes"
import { AdhesionOrderSummary } from "./AdhesionOrderSummary"

const details = {
  cycleMonths: 12,
  totalAmount: 988.7,
  pixTotalAmount: 988.7,
  creditCardTotalAmount: 1190.82,
  extrasTotalAmount: 29.9,
} as unknown as PublicAdhesionDetails

function renderSummary(billingType: "PIX" | "CREDIT_CARD", installments = 1): string {
  return renderToStaticMarkup(
    <AdhesionOrderSummary
      companyName="Corretora Exemplo"
      cnpj="11222333000181"
      cycleLabel="Anual"
      months={12}
      summary={buildAdhesionPaymentSummary(details, billingType)}
      installments={installments}
    >
      <button type="button">ação</button>
    </AdhesionOrderSummary>,
  )
}

describe("AdhesionOrderSummary", () => {
  it("mostra empresa, CNPJ, plano, adicionais e o total no PIX", () => {
    const html = renderSummary("PIX")
    expect(html).toContain("Corretora Exemplo")
    expect(html).toContain("CNPJ 11.222.333/0001-81")
    expect(html).toContain("Adicionais")
    expect(html).toContain("à vista no PIX")
    expect(html).toContain("ação")
  })

  it("no cartão mostra a parcela escolhida e não a economia do PIX", () => {
    const html = renderSummary("CREDIT_CARD", 12)
    expect(html).toContain("em 12x de")
    expect(html).not.toContain("Economia no PIX")
  })
})
