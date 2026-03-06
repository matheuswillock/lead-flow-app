export const DEFAULT_HEALTH_PLAN_NAMES = [
  "Nova Adesão",
  "Amil",
  "Alice",
  "Bradesco",
  "Hapvida",
  "MedSênior",
  "NotreDame Intermédica (GNDI)",
  "Omint",
  "Plena",
  "Porto Seguro",
  "Prevent Senior",
  "SulAmérica",
  "Unimed",
  "Outros",
] as const;

export function normalizeHealthPlanName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
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
