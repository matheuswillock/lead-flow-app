import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import type { PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"
import { PublicCheckoutPaymentStep } from "./PublicCheckoutPaymentStep"

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

function render(props: Partial<Parameters<typeof PublicCheckoutPaymentStep>[0]> = {}) {
  return renderToStaticMarkup(
    <PublicCheckoutPaymentStep
      form={prefill}
      errors={{}}
      disabled={false}
      addressLocked={false}
      showAddress
      onFieldChange={() => {}}
      {...props}
    />,
  )
}

describe("PublicCheckoutPaymentStep", () => {
  it("coleta endereço quando o fluxo exige", () => {
    const html = render()

    expect(html).toContain("CEP")
    expect(html).toContain("Endereço")
  })

  it("omite endereço nos fluxos sem coleta (PIX do Abacate)", () => {
    expect(render({ showAddress: false })).not.toContain("CEP")
  })

  it("nunca renderiza campos crus de cartão: o cartão só entra pelo campo seguro passado como filho", () => {
    const html = render({ showAddress: false })

    expect(html).not.toContain("Número do cartão")
    expect(html).not.toContain("CVV")
    expect(html).not.toContain("Nome do titular")
  })

  it("mostra o erro do campo ao lado dele", () => {
    const html = render({ errors: { email: "Informe um e-mail válido." } })

    expect(html).toContain("Informe um e-mail válido.")
  })

  it("renderiza a seção do cartão quando ela é passada como filho", () => {
    const html = render({ showAddress: false, children: <p>Formulário seguro do cartão</p> })

    expect(html).toContain("Formulário seguro do cartão")
  })
})
