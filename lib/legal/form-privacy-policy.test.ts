import { describe, expect, it } from "bun:test"
import { FORM_PRIVACY_POLICY_UPDATED_AT, renderFormPrivacyPolicy } from "./form-privacy-policy"
import type { LegalBlock } from "./legal-document-types"

function flatten(blocks: LegalBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "h2" || block.type === "h3") return block.text
      if (block.type === "p") return block.segments.map((segment) => segment.text).join("")
      return block.items.map((item) => item.map((segment) => segment.text).join("")).join("\n")
    })
    .join("\n")
}

describe("renderFormPrivacyPolicy", () => {
  it("preenche empresa, CNPJ formatado, e-mail e data, sem endereço nem tokens", () => {
    const text = flatten(
      renderFormPrivacyPolicy({
        companyName: "Corretora Exemplo Ltda",
        document: "12345678000195",
        contactEmail: "contato@exemplo.com.br",
      }),
    )

    expect(text).toContain("Corretora Exemplo Ltda, inscrita no CNPJ sob o nº 12.345.678/0001-95")
    expect(text).toContain("contato@exemplo.com.br")
    expect(text).toContain(`Última atualização: ${FORM_PRIVACY_POLICY_UPDATED_AT}`)
    expect(text).not.toContain("{{")
    expect(text).not.toContain("sede")
  })

  it("nunca exibe CPF: sem CNPJ a cláusula de documento é omitida", () => {
    const text = flatten(
      renderFormPrivacyPolicy({
        companyName: "Maria Souza",
        document: "123.456.789-09",
        contactEmail: "maria@exemplo.com.br",
      }),
    )

    expect(text).not.toContain("123.456.789-09")
    expect(text).not.toContain("12345678909")
    expect(text).not.toContain("CPF")
    expect(text).toContain("Esta página é operada por Maria Souza. A infraestrutura")
  })

  it("omite a cláusula de documento quando não há CPF/CNPJ válido", () => {
    const text = flatten(
      renderFormPrivacyPolicy({ companyName: "Maria Souza", document: null, contactEmail: "m@e.com" }),
    )

    expect(text).toContain("Esta página é operada por Maria Souza. A infraestrutura")
    expect(text).not.toContain("{{")
  })
})
