import { describe, expect, it } from "bun:test"
import { toPixImageSrc } from "./pixImage"

describe("toPixImageSrc", () => {
  it("prefixa base64 puro como PNG", () => {
    expect(toPixImageSrc("AAAA")).toBe("data:image/png;base64,AAAA")
  })

  it("preserva data URI já completa", () => {
    expect(toPixImageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA")
  })

  it("devolve null quando não há imagem", () => {
    expect(toPixImageSrc(undefined)).toBeNull()
    expect(toPixImageSrc("  ")).toBeNull()
  })
})
