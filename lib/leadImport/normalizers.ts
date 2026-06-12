import { LeadStatus } from "@prisma/client";
import { suggestLeadStatus } from "@/lib/leadImport/leadImportStatus";

export const normalizeText = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const normalizeDigits = (value: string) => value.replace(/\D/g, "");

export const parseCurrency = (value: string) => {
  if (!value) return undefined;
  let cleanValue = value.replace(/[^\d.,-]/g, "");
  if (!cleanValue) return undefined;

  if (cleanValue.includes(",")) {
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
  } else if ((cleanValue.match(/\./g) || []).length > 1) {
    const parts = cleanValue.split(".");
    const lastPart = parts.pop();
    cleanValue = parts.join("") + "." + lastPart;
  }

  const parsed = Number.parseFloat(cleanValue);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
};

export const parseImportDate = (value: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

export { mapHealthPlan } from "@/lib/leadImport/healthPlanMapping";

export const mapStatus = (value: string | null | undefined): LeadStatus =>
  LeadStatus[suggestLeadStatus(value)];

export const isLostStatus = (status: LeadStatus | null | undefined) =>
  status === LeadStatus.opportunityLost || status === LeadStatus.disqualified;
