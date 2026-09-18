import { describe, expect, it } from "bun:test"
import { isCreditQuantityInvalid, parseCreditQuantityInput } from "./subscription-credit-quantity"

describe("parseCreditQuantityInput / isCreditQuantityInvalid (T-21.11, regressão do NaN)", () => {
  it("campo vazio → NaN, e NaN é sempre inválido (nunca passa como quantidade válida)", () => {
    const quantity = parseCreditQuantityInput("")
    expect(Number.isNaN(quantity)).toBe(true)
    expect(isCreditQuantityInvalid({ quantity, action: "add", maxRemovable: 0 })).toBe(true)
  })

  it("regressão do bug original: `Number('')` é NaN e `NaN < 1` é `false` — a validação antiga deixava passar", () => {
    // Documenta exatamente por que o bug existia: com o operador `<` cru,
    // NaN nunca é "menor que 1", então a checagem antiga (`quantity < 1`)
    // não pegava o campo vazio. `isCreditQuantityInvalid` corrige isso
    // checando `Number.isInteger` explicitamente antes de comparar.
    const legacyBuggyCheck = Number.NaN < 1
    expect(legacyBuggyCheck).toBe(false)
    expect(isCreditQuantityInvalid({ quantity: Number.NaN, action: "add", maxRemovable: 10 })).toBe(true)
  })

  it("texto não numérico → NaN → inválido", () => {
    const quantity = parseCreditQuantityInput("abc")
    expect(Number.isNaN(quantity)).toBe(true)
    expect(isCreditQuantityInvalid({ quantity, action: "add", maxRemovable: 0 })).toBe(true)
  })

  it("quantidade válida (>=1, dentro do limite) → válida", () => {
    const quantity = parseCreditQuantityInput("3")
    expect(quantity).toBe(3)
    expect(isCreditQuantityInvalid({ quantity, action: "add", maxRemovable: 0 })).toBe(false)
  })

  it("remover mais do que o removível → inválido", () => {
    expect(isCreditQuantityInvalid({ quantity: 5, action: "remove", maxRemovable: 2 })).toBe(true)
  })

  it("0 ou negativo → inválido mesmo sendo inteiro", () => {
    expect(isCreditQuantityInvalid({ quantity: 0, action: "add", maxRemovable: 0 })).toBe(true)
    expect(isCreditQuantityInvalid({ quantity: -1, action: "add", maxRemovable: 0 })).toBe(true)
  })
})
