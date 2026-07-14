import { describe, expect, it } from "bun:test"
import { hashLegalDocument } from "./hash"

const document = {
  type: "terms",
  version: "1.0",
  title: "Termos de uso",
  schemaVersion: 1,
  content: [{ kind: "paragraph", text: "Conteúdo" }],
}

describe("hashLegalDocument", () => {
  it("é determinístico independentemente da ordem das chaves", () => {
    expect(hashLegalDocument(document)).toBe(
      hashLegalDocument({ content: document.content, title: document.title, version: document.version, type: document.type, schemaVersion: 1 })
    )
  })

  it("muda quando o conteúdo muda", () => {
    expect(hashLegalDocument(document)).not.toBe(
      hashLegalDocument({ ...document, content: [{ kind: "paragraph", text: "Outro conteúdo" }] })
    )
  })
})
