import { z } from "zod";

export const LEAD_REQUIRED_FIELD_ORDER = [
  "name",
  "phone",
  "responsible",
] as const;

export type LeadRequiredField = (typeof LEAD_REQUIRED_FIELD_ORDER)[number];

export const LEAD_REQUIRED_FIELD_LABELS: Record<LeadRequiredField, string> = {
  name: "Nome",
  phone: "Telefone",
  responsible: "Responsável",
};

export interface PendingFieldsFeedback {
  hasPendingFields: boolean;
  pendingFields: LeadRequiredField[];
  firstPendingField: LeadRequiredField | null;
  hash: string;
  message: string;
}

const FALLBACK_MESSAGE = "Existem campos obrigatórios pendentes. Revise o formulário.";

const formatPendingFieldsMessage = (labels: string[]): string => {
  if (labels.length === 0) {
    return FALLBACK_MESSAGE;
  }

  const visibleLabels = labels.slice(0, 4);
  const remainingCount = labels.length - visibleLabels.length;
  const suffix =
    remainingCount > 0 ? ` e mais ${remainingCount} campo(s)` : "";

  return `Preencha os campos obrigatórios: ${visibleLabels.join(", ")}${suffix}.`;
};

export function getPendingRequiredFieldsFeedback<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  values: unknown,
  requiredFieldOrder: readonly LeadRequiredField[] = LEAD_REQUIRED_FIELD_ORDER,
  labelsMap: Record<LeadRequiredField, string> = LEAD_REQUIRED_FIELD_LABELS
): PendingFieldsFeedback {
  const parsed = schema.safeParse(values);

  if (parsed.success) {
    return {
      hasPendingFields: false,
      pendingFields: [],
      firstPendingField: null,
      hash: "",
      message: "",
    };
  }

  const requiredFieldSet = new Set<LeadRequiredField>(requiredFieldOrder);
  const invalidRequiredFields = new Set<LeadRequiredField>();

  for (const issue of parsed.error.issues) {
    const [firstPath] = issue.path;
    if (typeof firstPath !== "string") continue;
    if (!requiredFieldSet.has(firstPath as LeadRequiredField)) continue;
    invalidRequiredFields.add(firstPath as LeadRequiredField);
  }

  const pendingFields = requiredFieldOrder.filter((field) =>
    invalidRequiredFields.has(field)
  );

  const pendingLabels = pendingFields.map(
    (field) => labelsMap[field] ?? field
  );

  return {
    hasPendingFields: pendingFields.length > 0,
    pendingFields,
    firstPendingField: pendingFields[0] ?? null,
    hash: pendingFields.join("|"),
    message: formatPendingFieldsMessage(pendingLabels),
  };
}
