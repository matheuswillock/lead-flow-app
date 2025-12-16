import { HealthPlan } from "@prisma/client";

// Mapeamento dos valores do enum para labels legíveis
export const HEALTH_PLAN_LABELS: Record<HealthPlan, string> = {
  NOVA_ADESAO: "Nova Adesão",
  AMIL: "Amil",
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

// Lista de opções para o Select
export const HEALTH_PLAN_OPTIONS = [
  { value: "NOVA_ADESAO", label: "Nova Adesão" },
  { value: "AMIL", label: "Amil" },
  { value: "BRADESCO", label: "Bradesco" },
  { value: "HAPVIDA", label: "Hapvida" },
  { value: "MEDSENIOR", label: "MedSênior" },
  { value: "GNDI", label: "NotreDame Intermédica (GNDI)" },
  { value: "OMINT", label: "Omint" },
  { value: "PLENA", label: "Plena" },
  { value: "PORTO_SEGURO", label: "Porto Seguro" },
  { value: "PREVENT_SENIOR", label: "Prevent Senior" },
  { value: "SULAMERICA", label: "SulAmérica" },
  { value: "UNIMED", label: "Unimed" },
  { value: "OUTROS", label: "Outros" },
];

// Função helper para obter o label
export function getHealthPlanLabel(plan: HealthPlan | null | undefined): string {
  if (!plan) return "";
  return HEALTH_PLAN_LABELS[plan] || plan;
}
