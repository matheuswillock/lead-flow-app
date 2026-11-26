import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import { PublicCheckoutFlow } from "./PublicCheckoutFlow"
import type { PublicCheckoutDetails, PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"

const details: PublicCheckoutDetails = {
  presetBillingType: "CREDIT_CARD",
  billingTypePrices: {
    PIX: { monthly: 100, total: 100 },
    CREDIT_CARD: { monthly: 100, total: 100 },
  },
  title: "Finalizar compra",
  subtitle: "Cobrança proporcional",
  includedTitle: "Time adicional",
  includedSubtitle: "Ativação após o pagamento",
  compositionTitle: "Seu plano",
  compositionRows: [],
  invoiceItems: [
    {
      icon: "team",
      title: "Time adicional",
      description: "Time Comercial",
      quantity: 1,
      unitAmountMonthly: 100,
      totalAmountMonthly: 100,
    },
  ],
  invoiceSummary: { monthlyTotal: 100, totalDueNow: 100, billingHint: "" },
  monthlyTotalLabel: "Mensal",
  monthlyTotalValue: "R$ 100,00 / mês",
  totalTitle: "Total",
  totalSubtitle: "",
  totalValue: "R$ 100,00",
  totalHint: "",
  startLabel: "Início",
  startValue: "01/01/2026",
  dueLabel: "Vencimento",
  dueValue: "01/02/2026",
  issuedLabel: "Vendido por Corretor Studio",
  issuedValue: "",
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

function render(props: Partial<Parameters<typeof PublicCheckoutFlow>[0]> = {}) {
  return renderToStaticMarkup(
    <PublicCheckoutFlow
      attemptStorageKey="test-attempt"
      details={details}
      payment={null}
      isLoading={false}
      isSubmitting={false}
      error={null}
      maxInstallments={3}
      prefill={prefill}
      onSubmit={async () => {}}
      {...props}
    />,
  )
}

describe("PublicCheckoutFlow: cartão do Abacate Pay", () => {
  it("sem chave do Abacate, o cartão some mesmo quando foi pedido e só o PIX continua", () => {
    const html = render({ availableMethods: ["PIX", "CREDIT_CARD"], abacatePublicKey: null })

    expect(html).toContain("Gerar QR Code PIX")
    expect(html).not.toContain("Pagar com cartão")
    expect(html).not.toContain("Cartão de crédito")
    expect(html).not.toContain("Número do cartão")
  })

  it("com chave do Abacate e cartão declarado, a forma de cartão é oferecida", () => {
    const html = render({ availableMethods: ["PIX", "CREDIT_CARD"], abacatePublicKey: "pk_test_publico" })

    expect(html).toContain("Cartão de crédito")
    expect(html).toContain("Pagar com cartão")
  })
})

describe("PublicCheckoutFlow: fases", () => {
  it("abre na fase Resumo, sem os campos do pagador", () => {
    const html = render({ availableMethods: ["PIX"] })

    expect(html).toContain("Seu plano")
    expect(html).toContain("Continuar")
    expect(html).not.toContain("Nome completo")
  })

  it("mostra o título, o rodapé de venda e o total na lateral sem cabeçalho laranja", () => {
    const html = render({ availableMethods: ["PIX"] })

    expect(html).toContain("Finalizar compra")
    expect(html).toContain("Vendido por Corretor Studio")
    expect(html).not.toContain("Emitido por")
    expect(html).toContain("Resumo do pedido")
  })
})

describe("PublicCheckoutFlow: estados", () => {
  it("mostra o skeleton enquanto carrega", () => {
    const html = render({ isLoading: true, details: null })

    expect(html).toContain('role="status"')
    expect(html).not.toContain("Gerar QR Code PIX")
  })

  it("mostra erro com nova tentativa quando o carregamento falha", () => {
    const html = render({ details: null, error: "Falha ao carregar" })

    expect(html).toContain("Falha ao carregar")
    expect(html).toContain("Tentar de novo")
  })

  it("mostra o estado indisponível quando não há detalhes", () => {
    const html = render({ details: null })

    expect(html).toContain("Compra online indisponível no momento")
  })
})
