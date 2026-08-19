import { describe, expect, it } from "bun:test"
import { resolvePublicFormAutocompleteAttrs } from "./autocomplete"

describe("resolvePublicFormAutocompleteAttrs", () => {
  it("deriva token de e-mail do mappingKey mesmo com type=text (achado real em produção)", () => {
    const attrs = resolvePublicFormAutocompleteAttrs({
      id: "q1",
      type: "text",
      mappingTarget: "native_field",
      mappingKey: "email",
    })
    expect(attrs.autoComplete).toBe("email")
    expect(attrs.name).toBe("email")
    expect(attrs.inputMode).toBe("email")
  })

  it("deriva token de telefone do mappingKey mesmo com type=email (achado real em produção)", () => {
    const attrs = resolvePublicFormAutocompleteAttrs({
      id: "q2",
      type: "email",
      mappingTarget: "native_field",
      mappingKey: "phone",
    })
    expect(attrs.autoComplete).toBe("tel")
    expect(attrs.name).toBe("phone")
    expect(attrs.inputMode).toBe("tel")
  })

  it("nome vem do mappingKey nativo, não do UUID da pergunta", () => {
    const attrs = resolvePublicFormAutocompleteAttrs({
      id: "11111111-1111-4111-8111-111111111111",
      type: "text",
      mappingTarget: "native_field",
      mappingKey: "name",
    })
    expect(attrs.autoComplete).toBe("name")
    expect(attrs.name).toBe("name")
  })

  it("campos nativos sem token específico (cnpj, idade) ficam off", () => {
    expect(
      resolvePublicFormAutocompleteAttrs({
        id: "q3",
        type: "text",
        mappingTarget: "native_field",
        mappingKey: "cnpj",
      }).autoComplete,
    ).toBe("off")
    expect(
      resolvePublicFormAutocompleteAttrs({
        id: "q4",
        type: "text",
        mappingTarget: "native_field",
        mappingKey: "age",
      }).autoComplete,
    ).toBe("off")
  })

  it("endereço deriva os tokens dedicados quando mapeado nativamente", () => {
    expect(
      resolvePublicFormAutocompleteAttrs({
        id: "q5",
        type: "text",
        mappingTarget: "native_field",
        mappingKey: "postalCode",
      }).autoComplete,
    ).toBe("postal-code")
    expect(
      resolvePublicFormAutocompleteAttrs({
        id: "q6",
        type: "text",
        mappingTarget: "native_field",
        mappingKey: "city",
      }).autoComplete,
    ).toBe("address-level2")
  })

  it("sem mappingKey (custom_field/notes/history), cai no fallback por type", () => {
    expect(
      resolvePublicFormAutocompleteAttrs({ id: "q7", type: "email", mappingTarget: null, mappingKey: null })
        .autoComplete,
    ).toBe("email")
    expect(
      resolvePublicFormAutocompleteAttrs({ id: "q8", type: "text", mappingTarget: "notes", mappingKey: null })
        .autoComplete,
    ).toBe("on")
  })

  it("types que nunca devem ser autofilled (moeda, escolha, consentimento, cálculo) ficam off", () => {
    for (const type of ["currency", "single_choice", "multiple_choice", "boolean", "consent", "calculation"]) {
      expect(
        resolvePublicFormAutocompleteAttrs({ id: "qx", type, mappingTarget: null, mappingKey: null })
          .autoComplete,
      ).toBe("off")
    }
  })

  it("mappingTarget diferente de native_field ignora o mappingKey (ex.: custom_field chamado 'email')", () => {
    const attrs = resolvePublicFormAutocompleteAttrs({
      id: "q9",
      type: "text",
      mappingTarget: "custom_field",
      mappingKey: "email",
    })
    // Não é o e-mail nativo do lead — não deve puxar autofill de e-mail.
    expect(attrs.autoComplete).toBe("on")
    expect(attrs.name).toBe("q9")
  })
})
