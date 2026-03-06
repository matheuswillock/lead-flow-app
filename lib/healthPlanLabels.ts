const LEGACY_HEALTH_PLAN_LABELS: Record<string, string> = {
  NOVA_ADESAO: "Nova Adesão",
  AMIL: "Amil",
  ALICE: "Alice",
  BRADESCO: "Bradesco",
  HAPVIDA: "Hapvida",
  MEDSENIOR: "MedSênior",
  GNDI: "NotreDame Intermédica (GNDI)",
  OMINT: "Omint",
  PLENA: "Plena",
  PORTO_SEGURO: "Porto Seguro",
  PREVENT_SENIOR: "Prevent Senior",
  SULAMERICA: "SulAmérica",
  UNIMED: "Unimed",
  OUTROS: "Outros",
};

export function getHealthPlanLabel(plan: string | null | undefined): string {
  if (!plan) return "";
  return LEGACY_HEALTH_PLAN_LABELS[plan] || plan;
}
