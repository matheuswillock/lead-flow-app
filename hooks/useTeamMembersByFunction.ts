"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { fetchTeamMembersPayload } from "@/lib/team/teamMembersClientCache";

type TeamFunction = "SDR" | "CLOSER";

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

      if (!options?.force && lastAppliedKeyRef.current === requestKey) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const payload = await fetchTeamMembersPayload(supabaseId, teamId, options);
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        setMembers(filterByFunction(payload.members, functionName));
        setError(null);
        lastAppliedKeyRef.current = requestKey;
      } catch (loadError) {
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erro ao carregar membros do time"
        );
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
