import { describe, expect, test } from "bun:test"
import { escapeIcsText } from "./escape-ics-text"

describe("escapeIcsText", () => {
  test("escapa barra invertida, ponto e vírgula e vírgula", () => {
    expect(escapeIcsText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d")
  })

  test("escapa \\n (LF) como texto \\n", () => {
    expect(escapeIcsText("linha1\nlinha2")).toBe("linha1\\nlinha2")
  })

  test("escapa \\r sozinho (CR sem LF) — achado R13-review3 / A-E1b", () => {
    // Antes da correção, um `\r` cru ficava no valor TEXT sem escape nenhum,
    // podendo ser lido como fim de linha "dobrada" por um parser de .ics
    // (RFC 5545 usa CRLF), abrindo espaço para injetar uma propriedade nova.
    const withBareCr = "Nome do lead\rDESCRIPTION:conteudo injetado"
    const escaped = escapeIcsText(withBareCr)

    expect(escaped).not.toContain("\r")
    expect(escaped).toBe("Nome do lead\\nDESCRIPTION:conteudo injetado")
  })

  test("escapa \\r\\n (CRLF) como um único \\n, sem duplicar", () => {
    const escaped = escapeIcsText("linha1\r\nlinha2")
    expect(escaped).not.toContain("\r")
    expect(escaped).toBe("linha1\\nlinha2")
  })

  test("null e undefined viram string vazia", () => {
    expect(escapeIcsText(null)).toBe("")
    expect(escapeIcsText(undefined)).toBe("")
  })
})
