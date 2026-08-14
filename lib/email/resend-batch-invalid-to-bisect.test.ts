import { describe, expect, it } from "bun:test"
import {
  formatResendInvalidToIsolatedFailureMessage,
  isResendInvalidToValidationError,
  splitBatchForInvalidToBisect,
} from "./resend-batch-invalid-to-bisect"

describe("isResendInvalidToValidationError", () => {
  it("detecta a mensagem real do Resend 422", () => {
    expect(
      isResendInvalidToValidationError(
        422,
        "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
      )
    ).toBe(true)
  })

  it("não bisecta outros 422", () => {
    expect(isResendInvalidToValidationError(422, "Some other validation")).toBe(false)
  })

  it("ignora outros status", () => {
    expect(isResendInvalidToValidationError(429, "Invalid `to` field")).toBe(false)
    expect(isResendInvalidToValidationError(undefined, "Invalid `to` field")).toBe(false)
  })
})

describe("splitBatchForInvalidToBisect", () => {
  it("divide em metades", () => {
    expect(splitBatchForInvalidToBisect(["a", "b", "c", "d"])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
    expect(splitBatchForInvalidToBisect(["a", "b", "c"])).toEqual([["a", "b"], ["c"]])
  })

  it("não divide lote unitário", () => {
    expect(splitBatchForInvalidToBisect(["a"])).toEqual([["a"], []])
  })
})

describe("formatResendInvalidToIsolatedFailureMessage", () => {
  it("isola o e-mail rejeitado", () => {
    expect(formatResendInvalidToIsolatedFailureMessage("mjc.f.@terra.com.br")).toBe(
      "E-mail rejeitado pelo Resend (Invalid to): mjc.f.@terra.com.br"
    )
  })
})
