import { z } from "zod";
import type { LeadCustomFieldType } from "@prisma/client";
import {
  type LeadCustomFieldDefinitionDTO,
  parseLeadCustomFieldOptions,
} from "./types";

function buildFieldSchema(definition: LeadCustomFieldDefinitionDTO): z.ZodTypeAny {
  const options = parseLeadCustomFieldOptions(definition.options) ?? [];
  const optionValues = options.map((option) => option.value);

  switch (definition.type as LeadCustomFieldType) {
    case "text": {
      const base = z.string().trim();
      return definition.isRequired ? base.min(1, `${definition.label} é obrigatório`) : base.optional();
    }
    case "number": {
      const base = z
        .number({ error: `${definition.label} deve ser um número` })
        .finite(`${definition.label} deve ser um número válido`);
      return definition.isRequired ? base : base.optional();
    }
    case "date": {
      const base = z
        .string()
        .trim()
        .refine((value) => !value || !Number.isNaN(Date.parse(value)), `${definition.label} deve ser uma data válida`);
      return definition.isRequired
        ? base.refine((value) => value.length > 0, `${definition.label} é obrigatório`)
        : base.optional();
    }
    case "select": {
      if (optionValues.length === 0) {
        return z.never({ message: `${definition.label} não possui opções configuradas` });
      }
      const base =
        optionValues.length === 1
          ? z.literal(optionValues[0])
          : z.enum(optionValues as [string, ...string[]], {
              message: `${definition.label} possui valor inválido`,
            });
      return definition.isRequired ? base : base.optional();
    }
    case "multi_select": {
      if (optionValues.length === 0) {
        return z.never({ message: `${definition.label} não possui opções configuradas` });
      }
      const optionSchema =
        optionValues.length === 1
          ? z.literal(optionValues[0])
          : z.enum(optionValues as [string, ...string[]]);
      const base = z
        .array(optionSchema)
        .refine((values) => new Set(values).size === values.length, `${definition.label} possui opções duplicadas`);
      return definition.isRequired
        ? base.min(1, `${definition.label} é obrigatório`)
        : base.optional();
    }
    case "boolean": {
      const base = z.boolean({ error: `${definition.label} deve ser verdadeiro ou falso` });
      return definition.isRequired ? base : base.optional();
    }
    default:
      return z.unknown();
  }
}

export function buildLeadCustomFieldsSchema(definitions: LeadCustomFieldDefinitionDTO[]) {
  const activeDefinitions = definitions.filter((definition) => definition.isActive);
  if (activeDefinitions.length === 0) {
    return z.object({ customFields: z.record(z.string(), z.unknown()).optional() });
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const definition of activeDefinitions) {
    shape[definition.key] = buildFieldSchema(definition);
  }

  return z.object({
    customFields: z.object(shape).partial().optional(),
  });
}

export function validateLeadCustomFieldsPayload(
  definitions: LeadCustomFieldDefinitionDTO[],
  customFields: Record<string, unknown> | undefined,
  enforceRequired: boolean
): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] } {
  if (!customFields) {
    if (!enforceRequired) {
      return { success: true, data: {} };
    }
    const missingRequired = definitions
      .filter((definition) => definition.isActive && definition.isRequired)
      .map((definition) => `${definition.label} é obrigatório`);
    if (missingRequired.length > 0) {
      return { success: false, errors: missingRequired };
    }
    return { success: true, data: {} };
  }

  const schema = buildLeadCustomFieldsSchema(definitions);
  const parsed = schema.safeParse({ customFields });
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  if (enforceRequired) {
    const missingRequired = definitions
      .filter((definition) => definition.isActive && definition.isRequired)
      .filter((definition) => {
        const value = customFields[definition.key];
        if (value === undefined || value === null) return true;
        if (definition.type === "text" && typeof value === "string" && value.trim() === "") return true;
        if (definition.type === "multi_select" && Array.isArray(value) && value.length === 0) return true;
        return false;
      })
      .map((definition) => `${definition.label} é obrigatório`);
    if (missingRequired.length > 0) {
      return { success: false, errors: missingRequired };
    }
  }

  return { success: true, data: customFields };
}
