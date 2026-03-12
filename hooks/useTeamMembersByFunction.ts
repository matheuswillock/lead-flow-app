"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";

type TeamFunction = "SDR" | "CLOSER";

const membersInFlightByKey = new Map<string, Promise<UserAssociated[]>>();
const membersCacheByKey = new Map<string, UserAssociated[]>();

const mapMemberToUserAssociated = (member: any): UserAssociated => ({
  id: member.profileId,
  name: member.name || member.email || "Usuário",
  avatarImageUrl: member.profileIconUrl || "",
  email: member.email || "",
  role: member.role,
  functions: member.functions ?? [],
});

function useTeamMembersByFunction(
  supabaseId?: string,
  teamId?: string | null,
  functionName: TeamFunction = "SDR"
) {
  const [members, setMembers] = useState<UserAssociated[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSuccessKeyRef = useRef<string | null>(null);
  const latestRequestKeyRef = useRef<string | null>(null);

  const loadMembers = useCallback(
    async (options?: { force?: boolean }) => {
      if (!supabaseId || !teamId) {
        setMembers([]);
        setError(null);
        lastSuccessKeyRef.current = null;
        latestRequestKeyRef.current = null;
        return;
      }

      const requestKey = `${supabaseId}:${teamId}:${functionName}`;
      latestRequestKeyRef.current = requestKey;

      if (!options?.force && lastSuccessKeyRef.current === requestKey) {
        return;
      }

      if (!options?.force) {
        const cachedMembers = membersCacheByKey.get(requestKey);
        if (cachedMembers) {
          setMembers(cachedMembers);
          setError(null);
          lastSuccessKeyRef.current = requestKey;
          return;
        }
      }

      const existingRequest = membersInFlightByKey.get(requestKey);
      const requestPromise =
        existingRequest ??
        (async (): Promise<UserAssociated[]> => {
          const response = await fetch(
            `/api/v1/teams/${teamId}/members?function=${functionName}`,
            {
              method: "GET",
              headers: {
                "x-supabase-user-id": supabaseId,
              },
            }
          );

          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.isValid) {
            const errorMessage =
              result?.errorMessages?.join(", ") || "Erro ao carregar membros do time";
            throw new Error(errorMessage);
          }

          const loadedMembers = ((result?.result?.members ?? []) as any[]).map(
            mapMemberToUserAssociated
          );
          membersCacheByKey.set(requestKey, loadedMembers);
          return loadedMembers;
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
        const loadedMembers = await requestPromise;
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        setMembers(loadedMembers);
        lastSuccessKeyRef.current = requestKey;
      } catch (loadError) {
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Erro ao carregar membros do time");
        setMembers([]);
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

  return {
    members,
    loading,
    error,
    refreshMembers: () => loadMembers({ force: true }),
  };
}

export function useTeamClosers(supabaseId?: string, teamId?: string | null) {
  return useTeamMembersByFunction(supabaseId, teamId, "CLOSER");
}

export function useTeamSdrs(supabaseId?: string, teamId?: string | null) {
  return useTeamMembersByFunction(supabaseId, teamId, "SDR");
}

export { useTeamMembersByFunction };
