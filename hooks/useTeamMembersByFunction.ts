"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";

type TeamFunction = "SDR" | "CLOSER";

type TeamMembersCacheEntry = {
  members: UserAssociated[];
  timestamp: number;
};

const MEMBERS_CACHE_TTL_MS = 60 * 1000;
const EMPTY_MEMBERS_CACHE_TTL_MS = 10 * 1000;

// Cache and in-flight maps are keyed by team only (not by function) so that
// CLOSER and SDR consumers share the same HTTP request to /teams/{id}/members
// and only filter the result locally.
const membersInFlightByKey = new Map<string, Promise<UserAssociated[]>>();
const membersCacheByKey = new Map<string, TeamMembersCacheEntry>();

const mapMemberToUserAssociated = (member: any): UserAssociated => ({
  id: member.profileId,
  name: member.name || member.email || "Usuário",
  avatarImageUrl: member.profileIconUrl || "",
  email: member.email || "",
  role: member.role,
  functions: member.functions ?? [],
  googleCalendarConnected: member.googleCalendarConnected ?? false,
});

const filterByFunction = (members: UserAssociated[], fn: TeamFunction) =>
  members.filter((m) => Array.isArray(m.functions) && m.functions.includes(fn));

function useTeamMembersByFunction(
  supabaseId?: string,
  teamId?: string | null,
  functionName: TeamFunction = "SDR"
) {
  const [members, setMembers] = useState<UserAssociated[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestKeyRef = useRef<string | null>(null);
  const lastAppliedKeyRef = useRef<string | null>(null);

  const loadMembers = useCallback(
    async (options?: { force?: boolean }) => {
      if (!supabaseId || !teamId) {
        setMembers([]);
        setError(null);
        latestRequestKeyRef.current = null;
        lastAppliedKeyRef.current = null;
        return;
      }

      const requestKey = `${supabaseId}:${teamId}`;
      latestRequestKeyRef.current = requestKey;

      if (!options?.force) {
        const cachedEntry = membersCacheByKey.get(requestKey);
        if (cachedEntry) {
          const cacheAgeMs = Date.now() - cachedEntry.timestamp;
          const ttlMs =
            cachedEntry.members.length === 0
              ? EMPTY_MEMBERS_CACHE_TTL_MS
              : MEMBERS_CACHE_TTL_MS;

          if (cacheAgeMs <= ttlMs) {
            setMembers(filterByFunction(cachedEntry.members, functionName));
            setError(null);
            lastAppliedKeyRef.current = requestKey;
            return;
          }
        }

        if (lastAppliedKeyRef.current !== requestKey) {
          setMembers([]);
          setError(null);
        }
      }

      const existingRequest = membersInFlightByKey.get(requestKey);
      const requestPromise =
        existingRequest ??
        (async (): Promise<UserAssociated[]> => {
          const response = await fetch(
            `/api/v1/teams/${teamId}/members`,
            {
              method: "GET",
              cache: "no-store",
              headers: {
                "x-supabase-user-id": supabaseId,
                "x-team-id": teamId,
              },
            }
          );

          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.isValid) {
            const errorMessage =
              result?.errorMessages?.join(", ") || "Erro ao carregar membros do time";
            throw new Error(errorMessage);
          }

          const allMembers = ((result?.result?.members ?? []) as any[]).map(
            mapMemberToUserAssociated
          );
          membersCacheByKey.set(requestKey, {
            members: allMembers,
            timestamp: Date.now(),
          });
          return allMembers;
        })();

      if (!existingRequest) {
        membersInFlightByKey.set(
          requestKey,
          requestPromise.finally(() => {
            membersInFlightByKey.delete(requestKey);
          })
        );
      }

      setLoading(true);
      setError(null);
      try {
        const allMembers = await requestPromise;
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        setMembers(filterByFunction(allMembers, functionName));
        setError(null);
        lastAppliedKeyRef.current = requestKey;
      } catch (loadError) {
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Erro ao carregar membros do time");
      } finally {
        if (latestRequestKeyRef.current === requestKey) {
          setLoading(false);
        }
      }
    },
    [supabaseId, teamId, functionName]
  );

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const refreshMembers = useCallback(() => loadMembers({ force: true }), [loadMembers]);

  return {
    members,
    loading,
    error,
    refreshMembers,
  };
}

export function useTeamClosers(supabaseId?: string, teamId?: string | null) {
  return useTeamMembersByFunction(supabaseId, teamId, "CLOSER");
}

export function useTeamSdrs(supabaseId?: string, teamId?: string | null) {
  return useTeamMembersByFunction(supabaseId, teamId, "SDR");
}

export { useTeamMembersByFunction };
