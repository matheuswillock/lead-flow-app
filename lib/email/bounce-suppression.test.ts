import { describe, expect, it } from "bun:test"
import {
  isMailboxFullBounce,
  shouldStampIsBouncedFromEventMetadata,
  shouldSuppressContactOnBounce,
} from "./bounce-suppression"

describe("shouldSuppressContactOnBounce", () => {
  it("não stamp em MailboxFull", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        subType: "MailboxFull",
        message: "The recipient's email provider sent a bounce message because the recipient's inbox was full.",
      })
    ).toBe(false)
  })

  it("não stamp no fallback legado da mensagem de caixa cheia", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        message: "The recipient's inbox was full.",
      })
    ).toBe(false)
    expect(isMailboxFullBounce({ message: "inbox was full" })).toBe(true)
  })

  it("stamp Permanent e ContentRejected (Terra)", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Permanent",
        subType: "General",
        message: "hard bounce",
      })
    ).toBe(true)
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        subType: "ContentRejected",
        message: "content that the provider doesn't allow",
      })
    ).toBe(true)
  })

  it("lê bounceSubType e bounceMessage do metadata do evento", () => {
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Transient",
        bounceSubType: "ContentRejected",
        bounceMessage: "content that the provider doesn't allow",
        bounceDiagnosticCode: ["smtp; 554 5.7.1"],
      })
    ).toBe(true)
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Transient",
        bounceSubType: "MailboxFull",
        bounceMessage: "The recipient's inbox was full.",
      })
    ).toBe(false)
  })
})
