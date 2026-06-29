import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import type { UserFunction } from "@prisma/client";

export type TeamTransferTarget = {
  teamId: string;
};

export type TeamMembersPayload = {
  members: UserAssociated[];
  transferTargets: TeamTransferTarget[];
};

type TeamMembersCacheEntry = {
  payload: TeamMembersPayload;
  timestamp: number;
};

const MEMBERS_CACHE_TTL_MS = 60 * 1000;
const EMPTY_MEMBERS_CACHE_TTL_MS = 10 * 1000;

const membersInFlightByKey = new Map<string, Promise<TeamMembersPayload>>();
const membersCacheByKey = new Map<string, TeamMembersCacheEntry>();

export const mapMemberToUserAssociated = (member: {
  profileId: string;
  name?: string | null;
  email?: string | null;
  profileIconUrl?: string | null;
  role?: string;
  functions?: string[] | null;
  googleCalendarConnected?: boolean;
}): UserAssociated => ({
  id: member.profileId,
  name: member.name || member.email || "Usuário",
  avatarImageUrl: member.profileIconUrl || "",
  email: member.email || "",
  role: member.role as UserAssociated["role"],
  functions: (member.functions ?? []) as UserFunction[],
  googleCalendarConnected: member.googleCalendarConnected ?? false,
});

async function fetchTeamMembersFromApi(
  supabaseId: string,
  teamId: string
): Promise<TeamMembersPayload> {
  const response = await fetch(`/api/v1/teams/${teamId}/members`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    },
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.isValid) {
    const errorMessage =
      result?.errorMessages?.join(", ") || "Erro ao carregar membros do time";
    throw new Error(errorMessage);
  }

  const members = ((result?.result?.members ?? []) as Parameters<
    typeof mapMemberToUserAssociated
  >[0][]).map(mapMemberToUserAssociated);

  const transferTargets = Array.isArray(result?.result?.transferTargets)
    ? (result.result.transferTargets as TeamTransferTarget[])
    : [];

  return { members, transferTargets };
}

export async function fetchTeamMembersPayload(
  supabaseId: string,
  teamId: string,
  options?: { force?: boolean }
): Promise<TeamMembersPayload> {
  const requestKey = `${supabaseId}:${teamId}`;

  if (!options?.force) {
    const cachedEntry = membersCacheByKey.get(requestKey);
    if (cachedEntry) {
      const cacheAgeMs = Date.now() - cachedEntry.timestamp;
      const ttlMs =
        cachedEntry.payload.members.length === 0
          ? EMPTY_MEMBERS_CACHE_TTL_MS
          : MEMBERS_CACHE_TTL_MS;

      if (cacheAgeMs <= ttlMs) {
        return cachedEntry.payload;
      }
    }

    const existingRequest = membersInFlightByKey.get(requestKey);
    if (existingRequest) {
      return existingRequest;
    }
  }

  const requestPromise = fetchTeamMembersFromApi(supabaseId, teamId)
    .then((payload) => {
      membersCacheByKey.set(requestKey, {
        payload,
        timestamp: Date.now(),
      });
      return payload;
    })
    .finally(() => {
      membersInFlightByKey.delete(requestKey);
    });

  membersInFlightByKey.set(requestKey, requestPromise);
  return requestPromise;
}
