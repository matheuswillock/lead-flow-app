export interface TeamMasterRef {
  id: string;
  masterId: string;
}

export interface TeamMasterWithSponsor {
  masterId: string;
  master: { sponsorMasterId: string | null } | null;
}

export interface ITeamRepository {
  /** Identifica o master (dono da conta) a partir do time. */
  findMasterRef(teamId: string): Promise<TeamMasterRef | null>;
  /** Master do time junto do sponsor da conta, para roteamento de notificacao. */
  findMasterWithSponsor(teamId: string): Promise<TeamMasterWithSponsor | null>;
  /** Indica se existe rota de transferencia configurada entre dois times. */
  hasTransferRoute(sourceTeamId: string, targetTeamId: string): Promise<boolean>;
  /**
   * Time onde um lead sem time explicito deve cair: o marcado como padrao e,
   * na ausencia dele, o mais antigo da conta.
   */
  findDefaultTeamIdByMaster(masterId: string): Promise<string | null>;
  /**
   * Todos os times da conta. Usado para invalidar em lote o que depende de um
   * dado do master — o bootstrap do formulario publico le `team.master.timezone`.
   */
  findTeamIdsByMaster(masterId: string): Promise<string[]>;
  /**
   * Atualiza nome, flag de padrao e rotas de transferencia numa transacao.
   *
   * A transacao existe para preservar o invariante da conta: sempre ha
   * exatamente um time padrao. Desmarcar o unico padrao e recusado, e marcar um
   * novo desmarca os demais no mesmo passo.
   *
   * Lanca `TeamUpdateError` com `reason` para o caller mapear o status HTTP.
   */
  updateTeamWithTransferRoutes(input: UpdateTeamWithTransferRoutesInput): Promise<TeamUpdateResult>;
  /** Snapshot do time antes de remover, para o log de auditoria. */
  findAuditSnapshot(teamId: string): Promise<TeamAuditSnapshot | null>;
  /** Remove o time. */
  deleteTeam(teamId: string): Promise<void>;
}

export type TeamUpdateFailureReason = "TEAM_NOT_FOUND" | "CANNOT_UNSET_ONLY_DEFAULT";

export class TeamUpdateError extends Error {
  constructor(readonly reason: TeamUpdateFailureReason) {
    super(reason);
    this.name = "TeamUpdateError";
  }
}

export interface UpdateTeamWithTransferRoutesInput {
  teamId: string;
  masterId: string;
  actorProfileId: string;
  name?: string;
  isDefault?: boolean;
  transferTargetTeamIds?: string[];
}

export interface TeamSnapshot {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface TeamUpdateResult {
  before: TeamSnapshot;
  after: TeamSnapshot;
}

export interface TeamAuditSnapshot {
  id: string;
  name: string;
  masterId: string;
  isDefault: boolean;
}
