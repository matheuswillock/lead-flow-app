import { describe, expect, test } from "bun:test"
import {
  buildXPostEmailSnippet,
  extractTextFromOEmbedHtml,
  parseXPostUrl,
} from "./x-post-embed"

describe("parseXPostUrl", () => {
  test("extrai id de x.com", () => {
    const parsed = parseXPostUrl("https://x.com/elonmusk/status/1234567890123456789")
    expect(parsed?.postId).toBe("1234567890123456789")
    expect(parsed?.postUrl).toBe("https://x.com/elonmusk/status/1234567890123456789")
  })

  test("extrai id de twitter.com", () => {
    const parsed = parseXPostUrl("https://twitter.com/user/status/9876543210987654321")
    expect(parsed?.postId).toBe("9876543210987654321")
    expect(parsed?.postUrl).toBe("https://twitter.com/user/status/9876543210987654321")
  })

  test("retorna null para url inválida", () => {
    expect(parseXPostUrl("https://example.com/post")).toBeNull()
  })
})

describe("buildXPostEmailSnippet", () => {
  test("gera card estático sem script", () => {
    const snippet = buildXPostEmailSnippet({
      authorName: "Autor",
      authorUrl: "https://x.com/autor",
      text: "Texto do post",
      postUrl: "https://x.com/autor/status/1",
    })

    expect(snippet).toContain("Autor")
    expect(snippet).toContain("Texto do post")
    expect(snippet).toContain("Ver post no X")
    expect(snippet).not.toContain("<script")
    expect(snippet).not.toContain("<iframe")
  })

  test("escapa html no conteúdo", () => {
    const snippet = buildXPostEmailSnippet({
      authorName: "<script>",
      text: "<b>alert</b>",
      postUrl: "https://x.com/a/status/1",
    })

    expect(snippet).not.toContain("<script>")
    expect(snippet).toContain("&lt;script&gt;")
    expect(snippet).toContain("&lt;b&gt;alert&lt;/b&gt;")
  })
})

describe("extractTextFromOEmbedHtml", () => {
  test("remove tags e preserva quebras", () => {
    const text = extractTextFromOEmbedHtml(
      '<blockquote><p>Linha 1<br>Linha 2</p></blockquote>'
    )

    expect(text).toContain("Linha 1")
    expect(text).toContain("Linha 2")
  })
})
