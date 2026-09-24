import { describe, expect, it } from "bun:test"
import { leadMatchesSearch } from "./lead-search"

describe("leadMatchesSearch", () => {
  it("encontra um lead pelo e-mail", () => {
    expect(
      leadMatchesSearch(
        {
          name: "Gilvan Leite Correa",
          leadCode: "G55844A",
          email: "cicaandrade26@gmail.com",
          createdAt: "2026-08-11T15:36:44.368Z",
        },
        "cicaandrade26@gmail.com",
      ),
    ).toBe(true)
  })
})
