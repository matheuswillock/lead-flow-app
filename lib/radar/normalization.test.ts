import { describe, expect, test } from "bun:test"
import {
  formatDisplayPhone,
  isValidRadarPrimaryIdentity,
  normalizeRadarDocument,
  normalizeRadarEmail,
  normalizeRadarName,
  normalizeRadarPhone,
  isRadarPhoneArtifact,
} from "./normalization"

describe("normalizeRadarPhone", () => {
  test("normaliza telefone brasileiro com DDD", () => {
    expect(normalizeRadarPhone("(11) 99999-9999")).toBe("5511999999999")
  })

  test("mantém telefone já com código do país", () => {
    expect(normalizeRadarPhone("+55 11 99999-9999")).toBe("5511999999999")
  })

  test("aceita fixo de 10 dígitos", () => {
    expect(normalizeRadarPhone("(11) 3333-4444")).toBe("551133334444")
  })

  // T-R6.1 (DA6) — ou é telefone, ou não entra no campo.
  //
  // Produção tinha 242 JIDs de grupo do WhatsApp (`120363…`, 18 dígitos) e 118
  // valores de 22-23 dígitos em `normalizedPhone` (auditoria CDP §4 R4). O
  // `slice(-11)` da elegibilidade transformava esse lixo em "celular válido"
  // aleatório, e a unique (teamId, normalizedPhone, normalizedName) estava
  // sendo alimentada com identidade não-telefônica.
  describe("recusa o que não é telefone", () => {
    test("JID de grupo do WhatsApp", () => {
      expect(normalizeRadarPhone("120363402477818639")).toBe("")
      expect(normalizeRadarPhone("120363402477818639@g.us")).toBe("")
    })

    test("lixo de 22-23 dígitos", () => {
      expect(normalizeRadarPhone("5511999999999123456789")).toBe("")
      expect(normalizeRadarPhone("55119999999991234567890")).toBe("")
    })

    test("dígitos de menos para ser telefone BR", () => {
      expect(normalizeRadarPhone("999999")).toBe("")
      expect(normalizeRadarPhone("119999999")).toBe("")
    })

    test("DDI 55 com comprimento implausível", () => {
      expect(normalizeRadarPhone("5511")).toBe("")
      expect(normalizeRadarPhone("55119999999999")).toBe("")
    })

    test("vazio e nulo continuam vazios", () => {
      expect(normalizeRadarPhone(null)).toBe("")
      expect(normalizeRadarPhone(undefined)).toBe("")
      expect(normalizeRadarPhone("")).toBe("")
      expect(normalizeRadarPhone("sem número")).toBe("")
    })
  })

  test("o que era aceito e é telefone de verdade continua aceito", () => {
    expect(normalizeRadarPhone("5511987654321")).toBe("5511987654321")
    expect(normalizeRadarPhone("551133334444")).toBe("551133334444")
    expect(normalizeRadarPhone("11987654321")).toBe("5511987654321")
  })
})

describe("isRadarPhoneArtifact", () => {
  test("distingue lixo de ausência de telefone", () => {
    // A diferença importa para o saneamento: artefato vai para
    // profileData.rawPhoneArtifacts antes de o campo ser anulado; ausência
    // não tem nada a preservar.
    expect(isRadarPhoneArtifact("120363402477818639")).toBe(true)
    expect(isRadarPhoneArtifact("5511999999999123456789")).toBe(true)
    expect(isRadarPhoneArtifact("5511987654321")).toBe(false)
    expect(isRadarPhoneArtifact("")).toBe(false)
    expect(isRadarPhoneArtifact(null)).toBe(false)
    expect(isRadarPhoneArtifact("sem número")).toBe(false)
  })
})

describe("normalizeRadarName", () => {
  test("remove acentos e colapsa espaços", () => {
    expect(normalizeRadarName("  João   da Silva  ")).toBe("joao da silva")
  })
})

describe("normalizeRadarEmail", () => {
  test("lowercase e trim", () => {
    expect(normalizeRadarEmail("  Maria@Example.COM ")).toBe("maria@example.com")
  })
})

describe("normalizeRadarDocument", () => {
  test("mantém somente dígitos", () => {
    expect(normalizeRadarDocument("12.345.678/0001-99")).toBe("12345678000199")
  })
})

describe("isValidRadarPrimaryIdentity", () => {
  test("exige telefone válido e nome", () => {
    expect(isValidRadarPrimaryIdentity("11999999999", "Maria")).toBe(true)
    expect(isValidRadarPrimaryIdentity("", "Maria")).toBe(false)
    expect(isValidRadarPrimaryIdentity("11999999999", "")).toBe(false)
  })
})

describe("formatDisplayPhone", () => {
  test("formata celular brasileiro", () => {
    expect(formatDisplayPhone("11999999999")).toBe("(11) 99999-9999")
  })
})
