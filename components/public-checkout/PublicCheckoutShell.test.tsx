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

describe("PublicCheckoutShell brandingOverride", () => {
  function renderOverride(
    brandingOverride: Parameters<typeof PublicCheckoutShell>[0]["brandingOverride"],
    provider?: Parameters<typeof PublicCheckoutShell>[0]["provider"]
  ) {
    return renderToStaticMarkup(
      <PublicCheckoutShell issuedValue="20/10/2026" provider={provider} brandingOverride={brandingOverride}>
        <div />
      </PublicCheckoutShell>
    )
  }

  it("mostra o nome vindo do banco no lugar do catálogo estático", () => {
    const html = renderOverride({ displayName: "Pagamentos XPTO" }, "ASAAS")

    expect(html).toContain("Pagamentos XPTO")
    expect(html).not.toContain("asaas-pagamentos-logo.svg")
  })

  it("mostra o logo do banco com o texto alternativo configurado", () => {
    const html = renderOverride(
      { displayName: "XPTO", logoUrl: "https://cdn.exemplo.com/xpto.svg", logoAltText: "Logo da XPTO" },
      "ABACATE_PAY"
    )

    expect(html).toContain("Logo da XPTO")
    expect(html).toContain("cdn.exemplo.com")
  })

  it("override vazio mantém o comportamento atual por provider", () => {
    expect(renderOverride({ displayName: null, logoUrl: null }, "ABACATE_PAY")).toContain(
      "Pagamento processado pela AbacatePay"
    )
    expect(renderOverride(undefined)).toContain("asaas-pagamentos-logo.svg")
  })

  it("com provider não resolvido, o override do banco ainda é exibido", () => {
    expect(renderOverride({ displayName: "XPTO" }, null)).toContain("XPTO")
  })
})
