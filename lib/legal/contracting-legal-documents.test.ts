import { describe, expect, it } from "bun:test"
import { contractingLegalDocuments } from "./contracting-legal-documents"
import type { LegalBlock } from "./legal-document-types"

function leadingNumbers(blocks: readonly LegalBlock[]): string[] {
  return blocks.flatMap((block) => {
    const text = block.type === "p" ? (block.segments[0]?.text ?? "") : block.type === "ul" ? "" : block.text
    const match = /^(\d+(?:\.\d+)?)\./.exec(text)
    return match ? [match[1]] : []
  })
}

describe("contractingLegalDocuments", () => {
  it("a política de cookies começa em 1 e segue em sequência", () => {
    const numbers = leadingNumbers(contractingLegalDocuments.cookies.blocks)
    expect(numbers[0]).toBe("1")
    expect(numbers).toContain("1.1")
    expect(numbers).toContain("1.10")
    expect(numbers.every((value) => value === "1" || value.startsWith("1."))).toBe(true)
    expect(JSON.stringify(contractingLegalDocuments.cookies)).not.toContain('"8.')
  })

  it("a privacidade não tem mais cookies e as seções vão de 1 a 13 sem lacuna", () => {
    const sections = contractingLegalDocuments.privacy.blocks
      .filter((block) => block.type === "h2")
      .map((block) => Number(/^(\d+)\./.exec((block as { text: string }).text)?.[1]))
    expect(sections).toEqual(Array.from({ length: 13 }, (_, index) => index + 1))
    expect(JSON.stringify(contractingLegalDocuments.privacy)).not.toContain("COOKIES E TECNOLOGIAS")
    const numbers = leadingNumbers(contractingLegalDocuments.privacy.blocks)
    expect(numbers).toContain("8.1")
    expect(numbers).not.toContain("14.1")
  })
})
