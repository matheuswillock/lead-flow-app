import { describe, expect, it } from "bun:test"
import { excludeBlocklistedEmails } from "./email-contact-blocklist"

describe("excludeBlocklistedEmails", () => {
  it("mantém a lista quando a blocklist está vazia", () => {
    const recipients = [{ email: "a@test.com" }, { email: "b@test.com" }]
    expect(excludeBlocklistedEmails(recipients, new Set())).toEqual(recipients)
  })

  it("remove e-mails da blocklist ignorando caixa", () => {
    const recipients = [
      { email: "A@test.com" },
      { email: "b@test.com" },
      { email: "c@test.com" },
    ]
    expect(excludeBlocklistedEmails(recipients, new Set(["a@test.com", "c@test.com"]))).toEqual([
      { email: "b@test.com" },
    ])
  })
})
