import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ReadOnlyAccessBanner } from "./ReadOnlyAccessBanner"

const MASTER_TEXT =
  "Há um pagamento pendente. Você só pode visualizar o CRM e a Carteira. Regularize o pagamento para voltar a usar tudo. Sem a regularização, o acesso é pausado por completo."
const MEMBER_TEXT =
  "Há um pagamento pendente nesta conta. Você só pode visualizar o CRM e a Carteira. Avise o administrador para regularizar o pagamento."

describe("ReadOnlyAccessBanner", () => {
  test("mantém o texto aprovado e o botão de pagamento para o master", () => {
    const markup = renderToStaticMarkup(<ReadOnlyAccessBanner supabaseId="conta-1" isBillingOwner />)

    expect(markup).toContain("Conta em modo somente leitura")
    expect(markup).toContain(MASTER_TEXT)
    expect(markup).toContain('href="/pagamento/conta-1"')
    expect(markup).toContain("Regularizar pagamento")
  })

  test("quem não é master vê o texto aprovado, sem botão de pagamento", () => {
    const markup = renderToStaticMarkup(<ReadOnlyAccessBanner supabaseId="conta-1" isBillingOwner={false} />)

    expect(markup).toContain(MEMBER_TEXT)
    expect(markup).not.toContain("/pagamento/")
    expect(markup).not.toContain("Regularizar pagamento")
  })

  test("no celular os detalhes começam recolhidos, com um botão acessível para abrir", () => {
    const markup = renderToStaticMarkup(<ReadOnlyAccessBanner supabaseId="conta-1" isBillingOwner />)

    const tagWith = (testId: string) => markup.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ""
    const details = tagWith("read-only-banner-details")
    const toggle = tagWith("read-only-banner-toggle")

    // Detalhes escondidos só no celular (de sm em diante aparecem sempre)
    expect(details).toContain("max-sm:hidden")
    expect(toggle).not.toBe("")
    expect(toggle).toContain('aria-expanded="false"')
    expect(toggle).toContain('aria-controls="read-only-banner-details"')
    expect(markup).toContain("Ver detalhes")
    // O botão de abrir só existe no celular
    expect(toggle).toMatch(/class="[^"]*\bsm:hidden/)
  })

  test("o botão de pagamento continua visível no celular, fora dos detalhes recolhidos", () => {
    const markup = renderToStaticMarkup(<ReadOnlyAccessBanner supabaseId="conta-1" isBillingOwner />)
    const detailsStart = markup.indexOf('data-testid="read-only-banner-details"')
    const paymentLinkPosition = markup.indexOf("/pagamento/conta-1")

    expect(detailsStart).toBeGreaterThan(-1)
    // O link fica depois do bloco de detalhes, não dentro dele
    const detailsBlockEnd = markup.indexOf("</p>", detailsStart)
    expect(paymentLinkPosition).toBeGreaterThan(detailsBlockEnd)
  })
})
