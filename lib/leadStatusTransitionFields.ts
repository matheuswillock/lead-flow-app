import type { BackofficeLeadTransitionFieldKey } from "@prisma/client";

export type LeadTransitionFieldKey = BackofficeLeadTransitionFieldKey;

/** API-facing key used in transition payloads and LeadInfoRequirementDialog */
export type LeadTransitionFieldApiKey =
  | "age"
  | "currentHealthPlan"
  | "referenceHospital"
  | "ongoingTreatment"
  | "email"
  | "phone"
  | "cnpj";

export type LeadTransitionFieldInputType = "age" | "text" | "textarea";

export interface LeadTransitionFieldDefinition {
  key: LeadTransitionFieldKey;
  leadColumn: keyof LeadTransitionFieldLeadShape;
  apiKey: LeadTransitionFieldApiKey;
  label: string;
  inputType: LeadTransitionFieldInputType;
}

export interface LeadTransitionFieldLeadShape {
  age: string | null;
  currentHealthPlan: string | null;
  referenceHospital: string | null;
  currentTreatment: string | null;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
}

export const LEAD_TRANSITION_FIELD_KEYS: LeadTransitionFieldKey[] = [
  "age",
  "currentHealthPlan",
  "referenceHospital",
  "currentTreatment",
  "email",
  "phone",
  "cnpj",
];

export const FIELD_CATALOG: Record<LeadTransitionFieldKey, LeadTransitionFieldDefinition> = {
  age: {
    key: "age",
    leadColumn: "age",
    apiKey: "age",
    label: "Idades dos beneficiários",
    inputType: "age",
  },
  currentHealthPlan: {
    key: "currentHealthPlan",
    leadColumn: "currentHealthPlan",
    apiKey: "currentHealthPlan",
    label: "Plano atual",
    inputType: "text",
  },
  referenceHospital: {
    key: "referenceHospital",
    leadColumn: "referenceHospital",
    apiKey: "referenceHospital",
    label: "Hospital de referência",
    inputType: "text",
  },
  currentTreatment: {
    key: "currentTreatment",
    leadColumn: "currentTreatment",
    apiKey: "ongoingTreatment",
    label: "Tratamento em andamento",
    inputType: "textarea",
  },
  email: {
    key: "email",
    leadColumn: "email",
    apiKey: "email",
    label: "E-mail",
    inputType: "text",
  },
  phone: {
    key: "phone",
    leadColumn: "phone",
    apiKey: "phone",
    label: "Telefone",
    inputType: "text",
  },
  cnpj: {
    key: "cnpj",
    leadColumn: "cnpj",
    apiKey: "cnpj",
    label: "CNPJ",
    inputType: "text",
  },
};

export function isLeadTransitionFieldKey(value: string): value is LeadTransitionFieldKey {
  return LEAD_TRANSITION_FIELD_KEYS.includes(value as LeadTransitionFieldKey);
}

export function resolveMissingLeadFields(
  lead: LeadTransitionFieldLeadShape,
  requiredKeys: LeadTransitionFieldKey[]
): LeadTransitionFieldApiKey[] {
  const missing: LeadTransitionFieldApiKey[] = [];

  for (const key of requiredKeys) {
    const definition = FIELD_CATALOG[key];
    const rawValue = lead[definition.leadColumn];
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      missing.push(definition.apiKey);
    }
  }

  return missing;
}

export function buildCurrentLeadInfo(lead: LeadTransitionFieldLeadShape): Record<LeadTransitionFieldApiKey, string | null> {
  return {
    age: lead.age ?? null,
    currentHealthPlan: lead.currentHealthPlan ?? null,
    referenceHospital: lead.referenceHospital ?? null,
    ongoingTreatment: lead.currentTreatment ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    cnpj: lead.cnpj ?? null,
  };
}

export function apiKeyToFieldKey(apiKey: LeadTransitionFieldApiKey): LeadTransitionFieldKey {
  const entry = Object.values(FIELD_CATALOG).find((item) => item.apiKey === apiKey);
  if (!entry) {
    throw new Error(`Unknown lead transition field api key: ${apiKey}`);
  }
  return entry.key;
}

export function mapLeadInfoPayloadForUpdate(payload: {
  age?: string;
  currentHealthPlan?: string;
  referenceHospital?: string;
  ongoingTreatment?: string;
  email?: string;
  phone?: string;
  cnpj?: string;
}) {
  const { ongoingTreatment, ...rest } = payload;
  return {
    ...rest,
    ...(ongoingTreatment !== undefined ? { currentTreatment: ongoingTreatment } : {}),
  };
}
