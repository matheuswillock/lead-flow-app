import { describe, expect, it } from "bun:test";
import { validateLeadCustomFieldsPayload } from "./schema";
import type { LeadCustomFieldDefinitionDTO } from "./types";

const baseDefinition: Omit<LeadCustomFieldDefinitionDTO, "id" | "key" | "type" | "label" | "options"> = {
  teamId: "11111111-1111-1111-1111-111111111111",
  isRequired: false,
  displayOrder: 0,
  isActive: true,
  showOnPublicForm: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function numberDefinition(overrides: Partial<LeadCustomFieldDefinitionDTO> = {}): LeadCustomFieldDefinitionDTO {
  return {
    ...baseDefinition,
    id: "d1",
    key: "idade",
    label: "Idade",
    type: "number",
    options: null,
    ...overrides,
  };
}

function selectDefinition(overrides: Partial<LeadCustomFieldDefinitionDTO> = {}): LeadCustomFieldDefinitionDTO {
  return {
    ...baseDefinition,
    id: "d2",
    key: "plano",
    label: "Plano",
    type: "select",
    options: [
      { value: "basico", label: "Básico" },
      { value: "premium", label: "Premium" },
    ],
    ...overrides,
  };
}

describe("validateLeadCustomFieldsPayload", () => {
  it("aceita campo number opcional deixado vazio (\"\") e não persiste o valor vazio", () => {
    const result = validateLeadCustomFieldsPayload([numberDefinition()], { idade: "" }, false);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.idade).toBeUndefined();
    }
  });

  it("aceita campo select opcional deixado vazio (\"\") e não persiste o valor vazio", () => {
    const result = validateLeadCustomFieldsPayload([selectDefinition()], { plano: "" }, false);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plano).toBeUndefined();
    }
  });

  it("ainda valida número inválido de verdade", () => {
    const result = validateLeadCustomFieldsPayload([numberDefinition()], { idade: "abc" }, false);
    expect(result.success).toBe(false);
  });

  it("ainda exige campo number obrigatório", () => {
    const result = validateLeadCustomFieldsPayload(
      [numberDefinition({ isRequired: true })],
      { idade: "" },
      true
    );
    expect(result.success).toBe(false);
  });

  it("persiste valor number válido normalmente", () => {
    const result = validateLeadCustomFieldsPayload([numberDefinition()], { idade: 30 }, false);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.idade).toBe(30);
    }
  });
});
