import { describe, expect, test } from "bun:test"
import {
  buildGenderCandidateFromEmailContactCustomFields,
  parseMappedGender,
  resolveGenderUpdateFromEmailContact,
} from "./email-contact-gender"

describe("email-contact-gender (F2)", () => {
  test("coluna de gênero mapeada vira genderSource mapped", () => {
    const candidate = buildGenderCandidateFromEmailContactCustomFields({
      gender: "Feminino",
    })

    expect(candidate).toEqual({ gender: "female", source: "mapped" })
  })

  test("sem coluna de gênero mapeada, socios alimenta inferência", () => {
    const candidate = buildGenderCandidateFromEmailContactCustomFields({
      socios: "João Silva",
    })

    expect(candidate).toEqual({ gender: "male", source: "inferred" })
  })

  test("sem gênero mapeado e sem socios não gera candidato", () => {
    expect(
      buildGenderCandidateFromEmailContactCustomFields({
        razaoSocial: "Maria Empreendimentos Ltda",
      })
    ).toBeNull()
  })

  test("perfil manual não é sobrescrito no sync", () => {
    const update = resolveGenderUpdateFromEmailContact(
      { gender: "male", genderSource: "manual" },
      { gender: "Feminino", socios: "Ana Costa" }
    )

    expect(update).toBeNull()
  })

  test("reimport idempotente não degrada fonte já resolvida", () => {
    const current = { gender: "female" as const, genderSource: "mapped" as const }

    expect(
      resolveGenderUpdateFromEmailContact(current, { gender: "Feminino" })
    ).toBeNull()
  })

  test("parseMappedGender aceita aliases comuns de planilha", () => {
    expect(parseMappedGender("M")).toBe("male")
    expect(parseMappedGender("feminino")).toBe("female")
    expect(parseMappedGender("indefinido")).toBe("unknown")
    expect(parseMappedGender("xyz")).toBeNull()
  })
})
