import { describe, expect, test } from "bun:test"
import {
  applyMasterTimezoneToTemplateVariables,
  findUnresolvedEmailTemplateTokens,
  interpolateEmailTemplate,
  type EmailTemplateVariableDefinition,
} from "./interpolate"

describe("interpolateEmailTemplate", () => {
  test("substitui variáveis built-in do destinatário", () => {
    const result = interpolateEmailTemplate(
      "Olá {{nome}}, seu e-mail é {{email}}",
      { email: "lead@example.com", name: "Maria" }
    )

    expect(result).toBe("Olá Maria, seu e-mail é lead@example.com")
  })

  test("prioriza customFields sobre defaults globais", () => {
    const result = interpolateEmailTemplate(
      "Cidade: {{cidade}}",
      {
        email: "lead@example.com",
        name: "Maria",
        customFields: { cidade: "São Paulo" },
      },
      { cidade: "Rio de Janeiro" }
    )

    expect(result).toBe("Cidade: São Paulo")
  })

  test("usa default global quando customField está vazio", () => {
    const result = interpolateEmailTemplate(
      "Empresa: {{empresa}}",
      { email: "lead@example.com", name: "Maria", customFields: {} },
      { empresa: "Corretor Studio" }
    )

    expect(result).toBe("Empresa: Corretor Studio")
  })

  test("usa fallback do template quando não há valor no contato", () => {
    const definitions: EmailTemplateVariableDefinition[] = [
      { key: "cupom", kind: "variable", fallbackValue: "PROMO10" },
    ]

    const result = interpolateEmailTemplate(
      "Use {{cupom}}",
      { email: "lead@example.com", name: "Maria" },
      {},
      definitions
    )

    expect(result).toBe("Use PROMO10")
  })

  test("resolve função customizada de soma", () => {
    const definitions: EmailTemplateVariableDefinition[] = [
      { key: "preco", kind: "variable", fallbackValue: "100" },
      { key: "taxa", kind: "variable", fallbackValue: "20" },
      {
        key: "total",
        kind: "function",
        definition: { operator: "sum", arguments: ["{{preco}}", "{{taxa}}"] },
      },
    ]

    const result = interpolateEmailTemplate(
      "Total: {{total}}",
      { email: "lead@example.com", name: "Maria" },
      {},
      definitions
    )

    expect(result).toBe("Total: 120")
  })

  test("resolve função de concatenação", () => {
    const definitions: EmailTemplateVariableDefinition[] = [
      { key: "cidade", kind: "variable", fallbackValue: "SP" },
      {
        key: "endereco",
        kind: "function",
        definition: {
          operator: "concat",
          arguments: ["{{nome}}", "{{cidade}}"],
          separator: " - ",
        },
      },
    ]

    const result = interpolateEmailTemplate(
      "{{endereco}}",
      { email: "lead@example.com", name: "Maria" },
      {},
      definitions
    )

    expect(result).toBe("Maria - SP")
  })

  test("mantém token desconhecido quando não há valor", () => {
    const result = interpolateEmailTemplate(
      "Valor: {{desconhecida}}",
      { email: "lead@example.com", name: "Maria" }
    )

    expect(result).toBe("Valor: {{desconhecida}}")
  })
})

describe("applyMasterTimezoneToTemplateVariables", () => {
  test("injeta timezone nas funções current_* sem timezone explícito", () => {
    const definitions: EmailTemplateVariableDefinition[] = [
      {
        key: "hoje",
        kind: "function",
        definition: { operator: "current_date" },
      },
      {
        key: "customSum",
        kind: "function",
        definition: { operator: "sum", arguments: ["1", "2"] },
      },
      {
        key: "dataFixa",
        kind: "function",
        definition: { operator: "current_date", timezone: "America/New_York" },
      },
    ]

    const result = applyMasterTimezoneToTemplateVariables(definitions, "America/Sao_Paulo")

    expect(result[0]?.definition?.timezone).toBe("America/Sao_Paulo")
    expect(result[1]?.definition?.timezone).toBeUndefined()
    expect(result[2]?.definition?.timezone).toBe("America/New_York")
  })
})

describe("findUnresolvedEmailTemplateTokens", () => {
  test("retorna tokens que permanecem após interpolação", () => {
    const tokens = findUnresolvedEmailTemplateTokens(
      "Olá {{nome}}",
      "Faltando {{campo_extra}}",
      { email: "lead@example.com", name: "Maria" }
    )

    expect(tokens).toEqual(["campo_extra"])
  })

  test("não retorna tokens resolvidos por fallback", () => {
    const definitions: EmailTemplateVariableDefinition[] = [
      { key: "cupom", kind: "variable", fallbackValue: "ABC" },
    ]

    const tokens = findUnresolvedEmailTemplateTokens(
      "Cupom {{cupom}}",
      "",
      { email: "lead@example.com", name: "Maria" },
      {},
      definitions
    )

    expect(tokens).toEqual([])
  })
})
