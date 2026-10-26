import type { Output } from "@/lib/output";

export interface ISetActiveTeamUseCase {
  execute(input: { supabaseId: string; teamId: string }): Promise<Output>;
}
