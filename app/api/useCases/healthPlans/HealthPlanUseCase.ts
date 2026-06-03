import { healthPlanService } from "@/app/api/services/healthPlans/HealthPlanService";
import { Output } from "@/lib/output";
import type { IHealthPlanUseCase } from "./IHealthPlanUseCase";

export const HEALTH_PLAN_ERROR_MESSAGES = {
  MISSING_SUPABASE_ID: "ID do usuário é obrigatório",
  PROFILE_NOT_FOUND: "Perfil não encontrado",
  FORBIDDEN_CREATE: "Acesso negado para criar plano de saúde",
  INVALID_NAME: "Nome do plano de saúde é obrigatório",
  DUPLICATED_NAME: "Plano de saúde já existe",
  INTERNAL_LIST_ERROR: "Erro ao listar planos de saúde",
  INTERNAL_CREATE_ERROR: "Erro ao criar plano de saúde",
} as const;

const HEALTH_PLAN_ADMIN_EMAIL = "matheuswillock@gmail.com";

export class HealthPlanUseCase implements IHealthPlanUseCase {
  async listHealthPlans(supabaseId: string): Promise<Output> {
    try {
      if (!supabaseId) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.MISSING_SUPABASE_ID], null);
      }

      const profile = await healthPlanService.findProfileBySupabaseId(supabaseId);

      if (!profile) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.PROFILE_NOT_FOUND], null);
      }

      const options = await healthPlanService.listOptions({ defaultOnly: true });

      return new Output(true, [], [], {
        healthPlans: options.map((option) => ({
          id: option.id,
          name: option.name,
          iconUrl: option.iconUrl,
          isDefault: option.isDefault,
        })),
      });
    } catch (error) {
      console.error("[HealthPlanUseCase][listHealthPlans] Erro ao listar planos de saúde:", error);
      return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_LIST_ERROR], null);
    }
  }

  async createHealthPlan(supabaseId: string, name: string): Promise<Output> {
    try {
      if (!supabaseId) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.MISSING_SUPABASE_ID], null);
      }

      const profile = await healthPlanService.findProfileBySupabaseId(supabaseId);

      if (!profile) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.PROFILE_NOT_FOUND], null);
      }

      const profileEmail = profile.email?.trim().toLowerCase() ?? "";
      if (profileEmail !== HEALTH_PLAN_ADMIN_EMAIL) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.FORBIDDEN_CREATE], null);
      }

      const safeName = name?.trim().replace(/\s+/g, " ") ?? "";
      if (!safeName) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INVALID_NAME], null);
      }

      const creation = await healthPlanService.createOption({
        name: safeName,
        createdBy: profile.id,
      });

      if (!creation.created && creation.duplicate) {
        return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.DUPLICATED_NAME], {
          healthPlan: {
            id: creation.option.id,
            name: creation.option.name,
          },
        });
      }

      return new Output(
        true,
        ["Plano de saúde criado com sucesso"],
        [],
        {
          healthPlan: {
            id: creation.option.id,
            name: creation.option.name,
          },
        }
      );
    } catch (error) {
      console.error("[HealthPlanUseCase][createHealthPlan] Erro ao criar plano de saúde:", error);
      return new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_CREATE_ERROR], null);
    }
  }
}

export const healthPlanUseCase = new HealthPlanUseCase();
