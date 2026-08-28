import { describe, expect, it } from "bun:test"
import { escapeLikePattern } from "./escape-like-pattern"

describe("escapeLikePattern", () => {
  it("escapa os curingas de LIKE", () => {
    expect(escapeLikePattern("maria_silva@example.com")).toBe("maria\\_silva@example.com")
    expect(escapeLikePattern("%@example.com")).toBe("\\%@example.com")
    expect(escapeLikePattern("a_b%c")).toBe("a\\_b\\%c")
  })

  it("escapa a própria barra invertida, sem escapar duas vezes o que já veio", () => {
    // Uma passada só: cada caractere é visitado uma vez, então `\_` na entrada
    // vira `\\\_` e o Postgres lê barra literal + underscore literal.
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b")
    expect(escapeLikePattern("a\\_b")).toBe("a\\\\\\_b")
  })

  it("não mexe em endereço sem metacaractere", () => {
    expect(escapeLikePattern("maria.silva@example.com")).toBe("maria.silva@example.com")
    expect(escapeLikePattern("")).toBe("")
  })

  it("não toca em caixa — o ILIKE é que ignora, não o escape", () => {
    expect(escapeLikePattern("Maria_Silva@Example.com")).toBe("Maria\\_Silva@Example.com")
  })
})
