type PortfolioProfile = {
  fullName: string | null;
  deletedAt: Date | null;
  /** Times em que o perfil ainda é membro; quando informado junto com `teamId`, detecta quem foi removido do time. */
  teamMemberships?: { teamId: string }[];
};

/**
 * Nome do SDR/closer na carteira. Quem saiu da corretora (perfil excluído) ou foi removido do time
 * da carteira continua aparecendo com o nome que estava atribuído ao cliente, marcado como desligado.
 */
export function portfolioProfileName(profile: PortfolioProfile, teamId?: string): string {
  const name = profile.fullName ?? '';
  const removedFromTeam =
    teamId !== undefined &&
    profile.teamMemberships !== undefined &&
    !profile.teamMemberships.some((membership) => membership.teamId === teamId);
  return (profile.deletedAt || removedFromTeam) && name ? `${name} (desligado)` : name;
}
