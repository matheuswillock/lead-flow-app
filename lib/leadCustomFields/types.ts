import type { LeadCustomFieldType } from "@prisma/client";

export type LeadCustomFieldOption = {
  value: string;
  label: string;
};

export type LeadCustomFieldDefinitionApiCreateInput = {
  label: string;
  key?: string;
  type: LeadCustomFieldType;
  options?: LeadCustomFieldOption[];
  isRequired?: boolean;
  displayOrder?: number;
  showOnPublicForm?: boolean;
};

export type LeadCustomFieldDefinitionDTO = {
  id: string;
  teamId: string;
  key: string;
  label: string;
  type: LeadCustomFieldType;
  options: LeadCustomFieldOption[] | null;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  showOnPublicForm: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeadCustomFieldValueDTO = {
  key: string;
  label: string;
  type: LeadCustomFieldType;
  value: unknown;
  isRequired: boolean;
};

export const MAX_ACTIVE_LEAD_CUSTOM_FIELD_DEFINITIONS = 30;

export const LEAD_CUSTOM_FIELD_TYPE_LABELS: Record<LeadCustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Seleção",
  multi_select: "Multi-seleção",
  boolean: "Sim/Não",
};

export function slugifyLeadCustomFieldKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function parseLeadCustomFieldOptions(raw: unknown): LeadCustomFieldOption[] | null {
  if (!Array.isArray(raw)) return null;
  const options = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = "value" in item ? String((item as { value: unknown }).value ?? "").trim() : "";
      const label = "label" in item ? String((item as { label: unknown }).label ?? "").trim() : "";
      if (!value || !label) return null;
      return { value, label };
    })
    .filter((item): item is LeadCustomFieldOption => item !== null);
  return options.length > 0 ? options : null;
}
