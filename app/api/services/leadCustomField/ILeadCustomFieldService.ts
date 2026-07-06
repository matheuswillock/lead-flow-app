import type { LeadCustomFieldType, Prisma } from "@prisma/client";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type {
  LeadCustomFieldDefinitionCreateInput,
  LeadCustomFieldDefinitionRecord,
  LeadCustomFieldDefinitionUpdateInput,
} from "@/app/api/infra/data/repositories/leadCustomField/ILeadCustomFieldRepository";

export interface ILeadCustomFieldService {
  listDefinitions(access: TeamAccess, includeInactive?: boolean): Promise<LeadCustomFieldDefinitionRecord[]>;
  createDefinition(
    access: TeamAccess,
    input: LeadCustomFieldDefinitionCreateInput
  ): Promise<
    | { definition: LeadCustomFieldDefinitionRecord }
    | { error: "max_active" | "duplicate_key" | "invalid_options" }
  >;
  updateDefinition(
    access: TeamAccess,
    definitionId: string,
    input: LeadCustomFieldDefinitionUpdateInput
  ): Promise<
    | { definition: LeadCustomFieldDefinitionRecord }
    | { error: "not_found" | "invalid_options" }
  >;
  deleteDefinition(
    access: TeamAccess,
    definitionId: string
  ): Promise<{ removed: boolean; softDeleted?: boolean; error?: "not_found" }>;
  listActiveDefinitionsByTeamId(teamId: string): Promise<LeadCustomFieldDefinitionRecord[]>;
  persistLeadCustomFieldValues(input: {
    teamId: string;
    leadId: string;
    customFields?: Record<string, unknown>;
    enforceRequired: boolean;
  }): Promise<{ success: true } | { success: false; errors: string[] }>;
  getLeadCustomFieldValues(leadId: string): Promise<
    Array<{
      key: string;
      label: string;
      type: LeadCustomFieldType;
      value: Prisma.JsonValue;
      isRequired: boolean;
    }>
  >;
}

export function isValidLeadCustomFieldKey(key: string): boolean {
  return /^[a-z][a-z0-9_]{0,63}$/.test(key);
}

export function validateOptionsForType(
  type: LeadCustomFieldType,
  options: Prisma.InputJsonValue | null | undefined
): boolean {
  if (type !== "select" && type !== "multi_select") {
    return true;
  }
  if (!Array.isArray(options) || options.length === 0) {
    return false;
  }
  return options.every((item) => {
    if (!item || typeof item !== "object") return false;
    const value = "value" in item ? String((item as { value: unknown }).value ?? "").trim() : "";
    const label = "label" in item ? String((item as { label: unknown }).label ?? "").trim() : "";
    return Boolean(value && label);
  });
}
