import {
  containsHealthPlanTerm,
  hasConcatenatedHealthPlanPrefix,
  HEALTH_PLAN_ALIAS_HINTS,
  normalizeHealthPlanName,
} from "@/lib/healthPlans";

export const buildHealthPlanOptionMap = (planNames: string[]): Map<string, string> =>
  new Map(planNames.map((name) => [normalizeHealthPlanName(name), name]));

export const mapHealthPlan = (
  value: string | null | undefined,
  optionNameByNormalized: Map<string, string>
): string | null => {
  if (!value) return null;
  const normalized = normalizeHealthPlanName(value);
  if (!normalized) return null;

  const exact = optionNameByNormalized.get(normalized);
  if (exact) return exact;

  for (const alias of HEALTH_PLAN_ALIAS_HINTS) {
    if (!containsHealthPlanTerm(value, alias.keyword)) continue;
    const canonical = optionNameByNormalized.get(normalizeHealthPlanName(alias.canonicalName));
    if (canonical) return canonical;
  }

  for (const [normalizedOptionName, optionName] of optionNameByNormalized.entries()) {
    if (
      containsHealthPlanTerm(value, optionName) ||
      normalized.startsWith(normalizedOptionName) ||
      hasConcatenatedHealthPlanPrefix(value, optionName)
    ) {
      return optionName;
    }
  }

  return null;
};
