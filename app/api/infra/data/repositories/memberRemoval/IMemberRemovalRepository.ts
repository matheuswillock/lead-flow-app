/** Lead que ficou sem responsável porque o usuário saiu do time. */
export type ReleasedLead = {
  id: string
  leadCode: string | null
  name: string
  status: string | null
}

export type OrphanNotificationRow = {
  recipientProfileId: string
  teamId: string
  type: "LEAD_ORPHANED"
  message: string
  metadata: Record<string, string | null>
}

export type RemovedProfile = {
  fullName: string | null
  email: string
  /** Id da conta de login (Supabase Auth); nulo para convite ainda não aceito. */
  supabaseId: string | null
}

export interface IMemberRemovalRepository {
  /**
   * Tira o usuário de SDR e closer dos leads do time que não estão na carteira e devolve quais
   * leads ficaram sem responsável. Clientes da carteira mantêm o nome atribuído (histórico).
   */
  releaseLeadsOfMember(teamId: string, profileId: string): Promise<ReleasedLead[]>
  /** Master da conta e managers do time: quem pode redistribuir os leads. */
  findRedistributionRecipientIds(teamId: string): Promise<string[]>
  findProfileForRemoval(profileId: string): Promise<RemovedProfile | null>
  createLeadOrphanNotifications(rows: OrphanNotificationRow[]): Promise<{ count: number }>
  /** Apaga as sessões de login do usuário: o acesso cai na próxima requisição. */
  revokeAuthSessions(authUserId: string): Promise<void>
}
