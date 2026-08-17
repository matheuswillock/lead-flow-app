import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { buildContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview"
import { ContactImportPreviewCard } from "./ContactImportPreviewCard"

describe("ContactImportPreviewCard", () => {
  it("explica que recusados não entram porque não são e-mails válidos", () => {
    const preview = buildContactImportPreview([
      { line: 1, email: "ana@gamil.com", name: "Ana" },
      { line: 2, email: "ana@ig.com.br", name: "Ig" },
      { line: 3, email: "lior@liorseguros.com", name: "Lior" },
    ])

    const html = renderToStaticMarkup(
      <ContactImportPreviewCard preview={preview} variant="detailed" />
    )

    expect(html).toContain("2 e-mails não serão incluídos porque não são e-mails válidos.")
    expect(html).toContain("Por que esses e-mails não entram na lista")
    expect(html).toContain("Domínio com erro de digitação")
    expect(html).toContain("Provedor de e-mail desativado")
    expect(html).toContain("ana@gamil.com")
    expect(html).toContain("1 contato será importado")
  })
})
