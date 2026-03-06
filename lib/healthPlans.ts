export function normalizeHealthPlanName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeForWordMatch(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsHealthPlanTerm(inputValue: string, term: string): boolean {
  const normalizedInput = normalizeForWordMatch(inputValue);
  const normalizedTerm = normalizeForWordMatch(term);

  if (!normalizedInput || !normalizedTerm) {
    return false;
  }

  const matcher = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedTerm)}(?:\\s|$)`);
  return matcher.test(normalizedInput);
}

export const HEALTH_PLAN_ALIAS_HINTS: Array<{ keyword: string; canonicalName: string }> = [
  { keyword: "gndi", canonicalName: "NotreDame Intermédica (GNDI)" },
  { keyword: "intermedica", canonicalName: "NotreDame Intermédica (GNDI)" },
  { keyword: "notredame", canonicalName: "NotreDame Intermédica (GNDI)" },
  { keyword: "notre dame", canonicalName: "NotreDame Intermédica (GNDI)" },
  { keyword: "med senior", canonicalName: "MedSênior" },
  { keyword: "porto", canonicalName: "Porto Seguro" },
  { keyword: "prevent", canonicalName: "Prevent Senior" },
  { keyword: "sul america", canonicalName: "SulAmérica" },
];
