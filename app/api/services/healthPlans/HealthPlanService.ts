import { prisma } from "@/app/api/infra/data/prisma";
import {
  containsHealthPlanTerm,
  hasConcatenatedHealthPlanPrefix,
  HEALTH_PLAN_ALIAS_HINTS,
  normalizeHealthPlanName,
} from "@/lib/healthPlans";

const OTHERS_PLAN_NORMALIZED_NAME = normalizeHealthPlanName("Outros");

export type HealthPlanOptionDTO = {
  id: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  isDefault: boolean;
  iconUrl: string | null;
};

export type HealthPlanValidationResult = {
  missing: string[];
  canonicalByNormalized: Map<string, string>;
};

class HealthPlanService {
  async findProfileBySupabaseId(supabaseId: string): Promise<{ id: string; email: string | null } | null> {
    return prisma.profile.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        email: true,
      },
    });
  }

  async listOptions(params?: { includeInactive?: boolean; defaultOnly?: boolean }): Promise<HealthPlanOptionDTO[]> {
    const options = await prisma.healthPlanOption.findMany({
      where: {
        ...(params?.includeInactive ? {} : { isActive: true }),
        ...(params?.defaultOnly ? { isDefault: true } : {}),
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        isActive: true,
        isDefault: true,
        iconUrl: true,
      },
    });

    return options.sort((a, b) => {
      const aIsOthers = a.normalizedName === OTHERS_PLAN_NORMALIZED_NAME;
      const bIsOthers = b.normalizedName === OTHERS_PLAN_NORMALIZED_NAME;

      if (aIsOthers && !bIsOthers) return 1;
      if (!aIsOthers && bIsOthers) return -1;

      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    });
  }

  async createOption(input: { name: string; createdBy: string }): Promise<{
    created: boolean;
    option: HealthPlanOptionDTO;
    duplicate: boolean;
  }> {
    const normalizedName = normalizeHealthPlanName(input.name);
    const safeName = input.name.trim().replace(/\s+/g, " ");

    const existing = await prisma.healthPlanOption.findFirst({
      where: { normalizedName },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        isActive: true,
        isDefault: true,
        iconUrl: true,
      },
    });

    if (existing) {
      return {
        created: false,
        option: {
          ...existing,
          isActive: existing.isActive,
          isDefault: existing.isDefault,
          iconUrl: existing.iconUrl,
        },
        duplicate: true,
      };
    }

    const created = await prisma.healthPlanOption.create({
      data: {
        name: safeName,
        normalizedName,
        createdBy: input.createdBy,
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        isActive: true,
        isDefault: true,
        iconUrl: true,
      },
    });

    return {
      created: true,
      option: created,
      duplicate: false,
    };
  }

  async validateAndCanonicalizePlans(
    planNames: Array<string | null | undefined>
  ): Promise<HealthPlanValidationResult> {
    const sanitized = planNames
      .map((plan) => (typeof plan === "string" ? plan.trim() : ""))
      .filter(Boolean);

    if (sanitized.length === 0) {
      return { missing: [], canonicalByNormalized: new Map() };
    }

    const normalizedSet = Array.from(
      new Set(sanitized.map((plan) => normalizeHealthPlanName(plan)))
    );

    const options = await prisma.healthPlanOption.findMany({
      where: {
        normalizedName: {
          in: normalizedSet,
        },
      },
      select: {
        name: true,
        normalizedName: true,
      },
    });

    const optionNameByNormalized = new Map(options.map((option) => [option.normalizedName, option.name]));
    const canonicalByNormalized = new Map<string, string>();
    const missing: string[] = [];

    for (const plan of sanitized) {
      const normalizedPlan = normalizeHealthPlanName(plan);
      const canonical = optionNameByNormalized.get(normalizedPlan);
      if (!canonical) {
        missing.push(plan);
        continue;
      }
      canonicalByNormalized.set(normalizedPlan, canonical);
    }

    return {
      missing,
      canonicalByNormalized,
    };
  }

  async resolvePlanNameFromText(value?: string | null): Promise<string | null> {
    if (!value) return null;
    const normalizedInput = normalizeHealthPlanName(value);
    if (!normalizedInput) return null;

    const options = await this.listOptions();
    const optionNameByNormalized = new Map(options.map((option) => [option.normalizedName, option.name]));

    const exact = optionNameByNormalized.get(normalizedInput);
    if (exact) return exact;

    for (const alias of HEALTH_PLAN_ALIAS_HINTS) {
      if (!containsHealthPlanTerm(value, alias.keyword)) continue;
      const normalizedCanonical = normalizeHealthPlanName(alias.canonicalName);
      const canonicalName = optionNameByNormalized.get(normalizedCanonical);
      if (canonicalName) return canonicalName;
    }

    for (const option of options) {
      if (
        containsHealthPlanTerm(value, option.name) ||
        normalizedInput.startsWith(option.normalizedName) ||
        hasConcatenatedHealthPlanPrefix(value, option.name)
      ) {
        return option.name;
      }
    }

    return null;
  }
}

export const healthPlanService = new HealthPlanService();
