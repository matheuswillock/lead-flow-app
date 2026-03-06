import { Output } from "@/lib/output";

export interface IHealthPlanUseCase {
  listHealthPlans(supabaseId: string): Promise<Output>;
  createHealthPlan(supabaseId: string, name: string): Promise<Output>;
}
