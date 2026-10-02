import { describe, expect, test } from "bun:test"
import { escapeHtml, escapeHtmlAttribute, isSafeHttpsUrl, sanitizeEmailHref } from "./escape-html"

describe("escapeHtml", () => {
  test("escapa & < > \" '", () => {
    expect(escapeHtml(`Ana & "Zé" <teste>`)).toBe("Ana &amp; &quot;Zé&quot; &lt;teste&gt;")
  })

  test("escapa tag de âncora maliciosa como texto puro", () => {
    const malicious = `<a href="https://evil">Confirme</a>`
    const escaped = escapeHtml(malicious)
    expect(escaped).not.toContain("<a href")
    expect(escaped).toBe("&lt;a href=&quot;https://evil&quot;&gt;Confirme&lt;/a&gt;")
  })

  test("null e undefined viram string vazia", () => {
    expect(escapeHtml(null)).toBe("")
    expect(escapeHtml(undefined)).toBe("")
  })

  test("string sem caracteres especiais não muda", () => {
    expect(escapeHtml("João da Silva")).toBe("João da Silva")
  })
})

describe("escapeHtmlAttribute", () => {
  test("escapa aspas para uso seguro dentro de atributo", () => {
    expect(escapeHtmlAttribute(`" onmouseover="evilJs(1)`)).toBe("&quot; onmouseover=&quot;evilJs(1)")
  })
})

describe("isSafeHttpsUrl", () => {
  test("aceita https", () => {
    expect(isSafeHttpsUrl("https://meet.google.com/abc-defg-hij")).toBe(true)
  })

  test("recusa javascript:", () => {
    expect(isSafeHttpsUrl("javascript:evilJs(1)")).toBe(false)
  })

  test("recusa http (sem tls)", () => {
    expect(isSafeHttpsUrl("http://example.com")).toBe(false)
  })

  test("recusa data:", () => {
    expect(isSafeHttpsUrl("data:text/html,<script>evilJs(1)</script>")).toBe(false)
  })

  test("recusa string vazia, nula ou inválida", () => {
    expect(isSafeHttpsUrl("")).toBe(false)
    expect(isSafeHttpsUrl(null)).toBe(false)
    expect(isSafeHttpsUrl(undefined)).toBe(false)
    expect(isSafeHttpsUrl("não é uma url")).toBe(false)
  })
})

describe("sanitizeEmailHref", () => {
  test("devolve a url escapada quando é https", () => {
    expect(sanitizeEmailHref("https://meet.google.com/abc")).toBe("https://meet.google.com/abc")
  })

  test("escapa aspas dentro de uma url https válida (não deixa fechar o atributo href)", () => {
    const withQuote = `https://x.com/"onmouseover="evilJs(1)`
    const result = sanitizeEmailHref(withQuote)
    expect(result).not.toContain('"')
    expect(result).toContain("&quot;")
  })

  test("descarta javascript: (devolve null)", () => {
    expect(sanitizeEmailHref("javascript:evilJs(document.cookie)")).toBeNull()
  })

  test("descarta http: (devolve null)", () => {
    expect(sanitizeEmailHref("http://example.com")).toBeNull()
  })

  test("descarta quando não há valor", () => {
    expect(sanitizeEmailHref(null)).toBeNull()
    expect(sanitizeEmailHref(undefined)).toBeNull()
    expect(sanitizeEmailHref("")).toBeNull()
  })
})
