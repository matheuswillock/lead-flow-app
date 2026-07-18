export type TeamScopeInput = {
  sessionTeamId: string | null;
  activeTeamId: string | null;
  requestedTeamId?: string | null;
  isTeamMember: boolean;
};

export type TeamScopeResult =
  | { ok: true; teamId: string }
  | { ok: false; errorCode: "TEAM_SCOPE_VIOLATION" };

/**
 * Source of truth: active session team, else profile activeTeamId when membership is valid.
 * Rejects when the caller requests a different team than the synchronized one.
 */
export function assertTeamScope(input: TeamScopeInput): TeamScopeResult {
  const allowedTeamId = input.sessionTeamId ?? input.activeTeamId;
  if (!allowedTeamId || !input.isTeamMember) {
    return { ok: false, errorCode: "TEAM_SCOPE_VIOLATION" };
  }

  if (input.requestedTeamId && input.requestedTeamId !== allowedTeamId) {
    return { ok: false, errorCode: "TEAM_SCOPE_VIOLATION" };
  }

  return { ok: true, teamId: allowedTeamId };
}
