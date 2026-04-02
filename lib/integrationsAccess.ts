const INTEGRATIONS_ALLOWED_TEAM_IDS = new Set<string>([
  "1c2d5668-5cd9-49a7-a138-3ccd2bea5cbb", // On | Select 3.0
  "a9c81e05-8b1a-47ad-a80d-dbc45603f068", // On | Select 1.0
]);

export function isTeamAllowedForIntegrations(teamId?: string | null): boolean {
  if (!teamId) {
    return false;
  }

  return INTEGRATIONS_ALLOWED_TEAM_IDS.has(teamId);
}

