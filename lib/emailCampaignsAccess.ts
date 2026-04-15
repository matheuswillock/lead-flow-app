const EMAIL_CAMPAIGNS_ALLOWED_TEAM_IDS = new Set<string>([
  "a9c81e05-8b1a-47ad-a80d-dbc45603f068", // On | Select 1.0
]);

export function isTeamAllowedForEmailCampaigns(teamId?: string | null): boolean {
  if (!teamId) {
    return false;
  }

  return EMAIL_CAMPAIGNS_ALLOWED_TEAM_IDS.has(teamId);
}
