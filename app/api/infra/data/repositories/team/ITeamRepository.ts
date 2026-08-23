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
}
