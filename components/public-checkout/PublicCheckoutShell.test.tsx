import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PublicCheckoutShell } from "./PublicCheckoutShell"

function render(provider?: Parameters<typeof PublicCheckoutShell>[0]["provider"]) {
  return renderToStaticMarkup(
    <PublicCheckoutShell issuedValue="20/10/2026" provider={provider}>
      <div />
    </PublicCheckoutShell>
  )
}

describe("PublicCheckoutShell footer", () => {
  it("mostra o logo do Asaas por padrão (fluxos legados)", () => {
    const html = render()

    expect(html).toContain("asaas-pagamentos-logo.svg")
    expect(html).not.toContain("AbacatePay")
  })

  it("mostra rótulo textual da AbacatePay, sem logo do Asaas, no pagamento do Abacate", () => {
    const html = render("ABACATE_PAY")

    expect(html).toContain("Pagamento processado pela AbacatePay")
    expect(html).not.toContain("asaas")
    expect(html).not.toContain("Asaas")
  })

  it("não mostra marca de provider enquanto o provider ainda não foi resolvido", () => {
    const html = render(null)

    expect(html).toContain("Ambiente seguro")
    expect(html).not.toContain("Asaas")
    expect(html).not.toContain("AbacatePay")
  })
})
