import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PixPaymentBlock } from "./PixPaymentBlock"

describe("PixPaymentBlock", () => {
  it("renderiza QR code, código copia e cola e ação de copiar", () => {
    const html = renderToStaticMarkup(
      <PixPaymentBlock payload="000201PIX" encodedImage="AAAA" expirationDate="2999-01-01T15:30:00.000Z" />
    )

    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain("000201PIX")
    expect(html).toContain("Copiar código PIX")
    expect(html).toContain("Expira")
  })

  it("omite o QR code quando a imagem não foi enviada", () => {
    const html = renderToStaticMarkup(<PixPaymentBlock payload="000201PIX" />)

    expect(html).not.toContain("<img")
    expect(html).toContain("000201PIX")
  })

  it("evita duplicar o prefixo de data URI", () => {
    const html = renderToStaticMarkup(
      <PixPaymentBlock payload="x" encodedImage="data:image/png;base64,BBBB" />
    )

    expect(html).toContain('src="data:image/png;base64,BBBB"')
    expect(html).not.toContain("base64,data:")
  })
})
