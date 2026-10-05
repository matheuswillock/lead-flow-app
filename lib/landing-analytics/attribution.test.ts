import { describe, expect, it } from "bun:test"
import { normalizeLandingAttribution } from "./attribution"

describe("normalizeLandingAttribution", () => {
  it("normalizes campaign context from email CTA parameters", () => {
    expect(
      normalizeLandingAttribution({
        campaign_id: "campaign-42",
        cs_el: "email-log-99",
        utm_source: "email",
        utm_medium: "newsletter",
        utm_campaign: "black-friday",
        referrer: "https://mail.example.test/message",
      }),
    ).toEqual({
      campaignId: "campaign-42",
      emailLogId: "email-log-99",
      source: "email",
      medium: "newsletter",
      campaign: "black-friday",
      referrer: "https://mail.example.test/message",
    })
  })

  it("drops blank and unsafe attribution values", () => {
    expect(
      normalizeLandingAttribution({
        campaign_id: " ",
        cs_el: "email-log-99",
        utm_source: "email\nforged-header",
        referrer: "javascript:alert(1)",
      }),
    ).toEqual({ emailLogId: "email-log-99" })
  })
})
