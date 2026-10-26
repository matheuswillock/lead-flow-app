import { describe, expect, it } from "bun:test"
import { resolveSafeReturnPath } from "./safe-return-path"

describe("resolveSafeReturnPath", () => {
  it("aceita a página de créditos", () => {
    expect(resolveSafeReturnPath("/adquirir/creditos")).toBe("/adquirir/creditos")
  })

  it("aceita o checkout interno por id", () => {
    expect(resolveSafeReturnPath("/addon-checkout/0b9c3f6e-1111-4222-8333-444455556666")).toBe(
      "/addon-checkout/0b9c3f6e-1111-4222-8333-444455556666",
    )
  })

  it.each([
    "https://evil.test/adquirir/creditos",
    "//evil.test/adquirir/creditos",
    "/\\evil.test",
    "/adquirir/creditos/../../admin",
    "/adquirir/creditos?x=1",
    "/outra-pagina",
    "javascript:void(0)",
    "",
    null,
    undefined,
  ])("rejeita %p", (value) => {
    expect(resolveSafeReturnPath(value as string | null | undefined)).toBeNull()
  })
})
