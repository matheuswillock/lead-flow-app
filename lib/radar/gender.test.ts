import { describe, expect, test } from "bun:test"
import { resolveGender } from "./gender"

describe("resolveGender", () => {
  test("fonte mapped presente vence e ignora inferred no estado atual", () => {
    const result = resolveGender(
      { gender: "female", genderSource: "inferred" },
      { gender: "male", source: "mapped" }
    )

    expect(result).toEqual({ gender: "male", genderSource: "mapped" })
  })

  test("sem mapped, inferred disponível usa inferred", () => {
    const result = resolveGender(
      { gender: null, genderSource: null },
      { gender: "female", source: "inferred" }
    )

    expect(result).toEqual({ gender: "female", genderSource: "inferred" })
  })

  test("nenhuma fonte útil retorna null", () => {
    expect(
      resolveGender(
        { gender: null, genderSource: null },
        { gender: "unknown", source: "inferred" }
      )
    ).toBeNull()

    expect(
      resolveGender({ gender: null, genderSource: null }, { gender: null, source: "mapped" })
    ).toBeNull()
  })

  test("genderSource manual nunca é sobrescrito por inferência", () => {
    const result = resolveGender(
      { gender: "male", genderSource: "manual" },
      { gender: "female", source: "inferred" }
    )

    expect(result).toBeNull()
  })

  test("inferred não sobrescreve mapped existente", () => {
    const result = resolveGender(
      { gender: "male", genderSource: "mapped" },
      { gender: "female", source: "inferred" }
    )

    expect(result).toBeNull()
  })
})
