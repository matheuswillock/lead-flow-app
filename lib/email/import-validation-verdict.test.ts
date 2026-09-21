import { describe, expect, it } from "bun:test"
import {
  AUDIENCE_REASON_BLOCKLISTED,
  AUDIENCE_REASON_BOUNCED,
  AUDIENCE_REASON_DEAD_ISP,
  AUDIENCE_REASON_DISPOSABLE,
  AUDIENCE_REASON_NO_MX,
  AUDIENCE_REASON_ROLE,
  AUDIENCE_REASON_TYPO_DOMAIN,
} from "./audience-prevalidation"
import {
  addToImportValidationCounts,
  classifyImportSkipReason,
  computeImportRiskLevel,
  countRemovalsRelevantForRisk,
  formatImportVerdictSummary,
  IMPORT_RISK_HIGH_MIN_REMOVED_ABSOLUTE,
  mergeImportValidationCounts,
  pickVolatileImportValidationCounts,
  sumImportValidationCounts,
  type ImportValidationCounts,
} from "./import-validation-verdict"

describe("classifyImportSkipReason — motivo → categoria", () => {
  it("mapeia cada motivo conhecido para a categoria certa", () => {
    expect(classifyImportSkipReason("E-mail ausente na linha")).toBe("emptyLine")
    expect(classifyImportSkipReason("E-mail ausente")).toBe("emptyLine")
    expect(classifyImportSkipReason("Formato de e-mail inválido")).toBe("syntax")
    expect(classifyImportSkipReason("E-mail contém espaços")).toBe("syntax")
    expect(classifyImportSkipReason("E-mail com múltiplos endereços")).toBe("syntax")
    expect(classifyImportSkipReason(AUDIENCE_REASON_TYPO_DOMAIN)).toBe("typoDomain")
    expect(classifyImportSkipReason(AUDIENCE_REASON_DEAD_ISP)).toBe("deadProvider")
    expect(classifyImportSkipReason(AUDIENCE_REASON_DISPOSABLE)).toBe("disposableDomain")
    expect(classifyImportSkipReason(AUDIENCE_REASON_ROLE)).toBe("roleAccount")
    expect(classifyImportSkipReason(AUDIENCE_REASON_NO_MX)).toBe("noMxDomain")
    expect(classifyImportSkipReason(AUDIENCE_REASON_BOUNCED)).toBe("suppressedBounce")
    expect(classifyImportSkipReason(AUDIENCE_REASON_BLOCKLISTED)).toBe("suppressedBlocklist")
    expect(classifyImportSkipReason("motivo desconhecido qualquer")).toBe("other")
  })
})

describe("computeImportRiskLevel — limiares 8% / 20% / 500 absolutos", () => {
  it("abaixo de 8% removidos = BAIXO", () => {
    expect(computeImportRiskLevel({ removedCount: 79, totalRows: 1000 })).toBe("low")
  })

  it("exatamente 8% = MÉDIO; 19,9% ainda MÉDIO", () => {
    expect(computeImportRiskLevel({ removedCount: 80, totalRows: 1000 })).toBe("medium")
    expect(computeImportRiskLevel({ removedCount: 199, totalRows: 1000 })).toBe("medium")
  })

  it("20% = ALTO", () => {
    expect(computeImportRiskLevel({ removedCount: 200, totalRows: 1000 })).toBe("high")
  })

  it(`${IMPORT_RISK_HIGH_MIN_REMOVED_ABSOLUTE} removidos absolutos = ALTO mesmo com fração baixa`, () => {
    expect(
      computeImportRiskLevel({
        removedCount: IMPORT_RISK_HIGH_MIN_REMOVED_ABSOLUTE,
        totalRows: 100_000,
      })
    ).toBe("high")
    expect(
      computeImportRiskLevel({
        removedCount: IMPORT_RISK_HIGH_MIN_REMOVED_ABSOLUTE - 1,
        totalRows: 100_000,
      })
    ).toBe("low")
  })

  it("arquivo vazio nunca é risco", () => {
    expect(computeImportRiskLevel({ removedCount: 0, totalRows: 0 })).toBe("low")
  })
})

describe("countRemovalsRelevantForRisk — duplicado e linha vazia não queimam reputação", () => {
  it("exclui duplicate e emptyLine do numerador de risco", () => {
    const counts: ImportValidationCounts = {
      syntax: 10,
      duplicate: 300,
      emptyLine: 50,
      noMxDomain: 5,
    }
    expect(countRemovalsRelevantForRisk(counts)).toBe(15)
    expect(sumImportValidationCounts(counts)).toBe(365)
  })
})

describe("pickVolatileImportValidationCounts — resume entre claims", () => {
  it("recupera SÓ as chaves voláteis do JSON persistido", () => {
    const persisted = {
      syntax: 12,
      typoDomain: 3,
      noMxDomain: 7,
      suppressedBounce: 4,
      suppressedBlocklist: 2,
      duplicate: 9,
    }
    expect(pickVolatileImportValidationCounts(persisted)).toEqual({
      noMxDomain: 7,
      suppressedBounce: 4,
      suppressedBlocklist: 2,
    })
  })

  it("JSON deformado devolve vazio", () => {
    expect(pickVolatileImportValidationCounts(null)).toEqual({})
    expect(pickVolatileImportValidationCounts([1, 2])).toEqual({})
    expect(pickVolatileImportValidationCounts("x")).toEqual({})
  })
})

describe("merge/add/format", () => {
  it("mergeia grupos somando por categoria", () => {
    const merged = mergeImportValidationCounts({ syntax: 2, noMxDomain: 1 }, { syntax: 3 })
    expect(merged).toEqual({ syntax: 5, noMxDomain: 1 })
  })

  it("addToImportValidationCounts ignora quantidades não positivas", () => {
    const counts: ImportValidationCounts = {}
    addToImportValidationCounts(counts, "duplicate", 0)
    addToImportValidationCounts(counts, "duplicate", -3)
    expect(counts).toEqual({})
  })

  it("resumo humano lista total e categorias não vazias", () => {
    const summary = formatImportVerdictSummary({
      suppressedBounce: 43,
      noMxDomain: 22,
      disposableDomain: 12,
      duplicate: 10,
    })
    expect(summary).toContain("87 removidos")
    expect(summary).toContain("43 supressão (bounce)")
    expect(summary).toContain("22 sem MX")
    expect(summary).toContain("12 descartáveis")
    expect(summary).toContain("10 duplicados")
  })

  it("sem remoções: resumo curto", () => {
    expect(formatImportVerdictSummary({})).toBe("0 removidos")
  })
})
