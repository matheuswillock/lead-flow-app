import { describe, expect, it } from "bun:test"
import {
  CONTENT_REJECTED_BOUNCE_SUBTYPE,
  isMailboxFullBounce,
  isPermanentBounce,
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

  it("stamp só Permanent — ContentRejected (Terra) não stamp", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Permanent",
        subType: "General",
        message: "hard bounce",
      })
    ).toBe(true)
    expect(isPermanentBounce({ type: "Permanent" })).toBe(true)
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        subType: CONTENT_REJECTED_BOUNCE_SUBTYPE,
        message: "content that the provider doesn't allow",
      })
    ).toBe(false)
  })

  it("não stamp sem bounceType", () => {
    expect(
      shouldSuppressContactOnBounce({
        subType: "General",
        message: "hard bounce",
      })
    ).toBe(false)
  })

  it("lê bounceType Permanent do metadata do evento", () => {
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Transient",
        bounceSubType: CONTENT_REJECTED_BOUNCE_SUBTYPE,
        bounceMessage: "content that the provider doesn't allow",
        bounceDiagnosticCode: ["smtp; 554 5.7.1"],
      })
    ).toBe(false)
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Permanent",
        bounceSubType: "General",
        bounceMessage: "user unknown",
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
