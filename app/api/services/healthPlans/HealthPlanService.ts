import { prisma } from "@/app/api/infra/data/prisma";
import { HEALTH_PLAN_ALIAS_HINTS, normalizeHealthPlanName } from "@/lib/healthPlans";

export type HealthPlanOptionDTO = {
  id: string;
  name: string;
  normalizedName: string;
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

  async listOptions(): Promise<HealthPlanOptionDTO[]> {
    return prisma.healthPlanOption.findMany({
      select: {
        id: true,
        name: true,
        normalizedName: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async createOption(input: { name: string; createdBy: string }): Promise<{
    created: boolean;
    option: HealthPlanOptionDTO;
    duplicate: boolean;
  }> {
    const normalizedName = normalizeHealthPlanName(input.name);
    const safeName = input.name.trim().replace(/\s+/g, " ");

    const existing = await prisma.healthPlanOption.findUnique({
      where: { normalizedName },
      select: {
        id: true,
        name: true,
        normalizedName: true,
      },
    });

    if (existing) {
      return {
        created: false,
        option: existing,
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
      const normalizedKeyword = normalizeHealthPlanName(alias.keyword);
      if (!normalizedInput.includes(normalizedKeyword)) continue;
      const normalizedCanonical = normalizeHealthPlanName(alias.canonicalName);
      const canonicalName = optionNameByNormalized.get(normalizedCanonical);
      if (canonicalName) return canonicalName;
    }

    for (const option of options) {
      if (normalizedInput.includes(option.normalizedName) || option.normalizedName.includes(normalizedInput)) {
        return option.name;
      }
    }

    return null;
  }
}

export const healthPlanService = new HealthPlanService();
