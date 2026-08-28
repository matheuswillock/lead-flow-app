import { describe, expect, it } from "bun:test"
import {
  excludeBlocklistedEmails,
  partitionByBlocklist,
} from "./email-contact-blocklist"

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

describe("partitionByBlocklist", () => {
  it("devolve tudo em allowed quando a blocklist está vazia", () => {
    const rows = [{ email: "a@test.com" }, { email: "b@test.com" }]
    expect(partitionByBlocklist(rows, new Set())).toEqual({ allowed: rows, blocked: [] })
  })

  it("separa bloqueados dos permitidos ignorando caixa e espaços", () => {
    const rows = [
      { email: " A@test.com " },
      { email: "b@test.com" },
      { email: "C@TEST.com" },
    ]

    expect(partitionByBlocklist(rows, new Set(["a@test.com", "c@test.com"]))).toEqual({
      allowed: [{ email: "b@test.com" }],
      blocked: [{ email: " A@test.com " }, { email: "C@TEST.com" }],
    })
  })

  it("preserva o objeto original nas duas metades (não normaliza a linha)", () => {
    const row = { email: "A@test.com", line: 7, name: "Fulano" }
    const { blocked } = partitionByBlocklist([row], new Set(["a@test.com"]))
    expect(blocked[0]).toBe(row)
  })
})
