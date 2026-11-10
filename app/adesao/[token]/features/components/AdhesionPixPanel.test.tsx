import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import { AdhesionPixPanel } from "./AdhesionPixPanel"

const now = Date.parse("2026-11-06T12:00:00.000Z")
const pix = {
  encodedImage: "",
  payload: "00020126pix-payload",
  expirationDate: "2026-11-06T12:30:00.000Z",
}

function render(isExpired: boolean): string {
  return renderToStaticMarkup(
    <AdhesionPixPanel
      pix={pix}
      email="maria@example.com"
      now={now}
      isExpired={isExpired}
      isValidating={false}
      isRegenerating={false}
      onValidate={() => undefined}
      onRegenerate={() => undefined}
    />,
  )
}

describe("AdhesionPixPanel", () => {
  it("pendente: mostra o tempo restante, o código, o passo a passo e para onde vai o acesso", () => {
    const html = render(false)
    expect(html).toContain("Pague com PIX para concluir")
    expect(html).toContain("30:00")
    expect(html).toContain("00020126pix-payload")
    expect(html).toContain("Abra o app do seu banco")
    expect(html).toContain("maria@example.com")
    expect(html).toContain("Já paguei")
  })

  it("expirado: troca o QR Code pelo botão de gerar um novo PIX", () => {
    const html = render(true)
    expect(html).toContain("Este PIX expirou")
    expect(html).toContain("Gerar novo PIX")
    expect(html).not.toContain("00020126pix-payload")
  })
})
