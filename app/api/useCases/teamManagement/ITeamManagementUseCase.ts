import type { Output } from "@/lib/output";

export interface UpdateTeamInput {
  teamId: string;
  masterId: string;
  actorProfileId: string;
  name?: string;
  isDefault?: boolean;
  transferTargetTeamIds?: string[];
}

export interface ITeamManagementUseCase {
  /**
   * Atualiza nome, flag de padrao e rotas de transferencia, preservando o
   * invariante de exatamente um time padrao por conta.
   */
  updateTeam(input: UpdateTeamInput): Promise<Output>;

  /**
   * Resolve quem pede a exclusao e quem responde pela cobranca da conta.
   * Separado da exclusao porque a rota precisa reautenticar por senha no meio.
   */
  findDeletionActors(supabaseId: string, managerId: string): Promise<Output>;

  /** Remove o time e registra a auditoria. */
  deleteTeam(teamId: string, actorProfileId: string): Promise<Output>;
}
