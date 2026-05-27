"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import type { Attachment } from "@/components/ui/attachment-list";
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";

export type LeadDetails = {
  lead: LeadResponseDTO;
  attachments: Attachment[];
  teamMembers: UserAssociated[];
};

type LeadDetailsCacheEntry = {
  details: LeadDetails;
  timestamp: number;
};

const LEAD_DETAILS_CACHE_TTL_MS = 60 * 1000;
const leadDetailsCacheByKey = new Map<string, LeadDetailsCacheEntry>();
const leadDetailsInFlightByKey = new Map<string, Promise<LeadDetails>>();

function buildCacheKey(
  supabaseId: string,
  teamId: string,
  leadId: string
): string {
  return `${supabaseId}:${teamId}:${leadId}`;
}

function mapRawMember(member: Record<string, unknown>): UserAssociated {
  return {
    id: (member.profileId as string) ?? "",
    name:
      (member.name as string) ||
      (member.email as string) ||
      "Usuário",
    avatarImageUrl: (member.profileIconUrl as string) ?? "",
    email: (member.email as string) ?? "",
    role: member.role as UserAssociated["role"],
    functions: (member.functions as UserAssociated["functions"]) ?? [],
    googleCalendarConnected:
      (member.googleCalendarConnected as boolean) ?? false,
  };
}

async function fetchLeadDetails(
  supabaseId: string,
  teamId: string,
  leadId: string
): Promise<LeadDetails> {
  const response = await fetch(`/api/v1/leads/${leadId}/details`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    },
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.isValid) {
    const errorMessage =
      Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
        ? result.errorMessages.join(", ")
        : "Erro ao carregar detalhes do lead";
    throw new Error(errorMessage);
  }

  const raw = result.result as {
    lead: LeadResponseDTO;
    attachments: unknown[];
    teamMembers: Record<string, unknown>[];
  };

  return {
    lead: raw.lead,
    attachments: (raw.attachments ?? []) as Attachment[],
    teamMembers: (raw.teamMembers ?? []).map(mapRawMember),
  };
}

async function loadLeadDetailsWithDedupe(
  supabaseId: string,
  teamId: string,
  leadId: string,
  force = false
): Promise<LeadDetails> {
  const key = buildCacheKey(supabaseId, teamId, leadId);

  if (!force) {
    const cached = leadDetailsCacheByKey.get(key);
    if (cached && Date.now() - cached.timestamp <= LEAD_DETAILS_CACHE_TTL_MS) {
      return cached.details;
    }
  }

  const existingRequest = leadDetailsInFlightByKey.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = fetchLeadDetails(supabaseId, teamId, leadId).then(
    (details) => {
      leadDetailsCacheByKey.set(key, { details, timestamp: Date.now() });
      return details;
    }
  );

  leadDetailsInFlightByKey.set(
    key,
    requestPromise.finally(() => {
      leadDetailsInFlightByKey.delete(key);
    })
  );

  return requestPromise;
}

/**
 * Invalida o cache de detalhes de um lead específico.
 * Usar após uploads/deletes de anexos ou mutações no lead.
 */
export function invalidateLeadDetailsCache(
  supabaseId: string,
  teamId: string,
  leadId: string
): void {
  const key = buildCacheKey(supabaseId, teamId, leadId);
  leadDetailsCacheByKey.delete(key);
}

/**
 * Hook que busca lead + anexos + membros do time em um único request
 * para o endpoint agregado GET /api/v1/leads/{id}/details.
 *
 * - Deduplicação: múltiplos consumidores com a mesma chave compartilham
 *   o mesmo request em voo.
 * - Cache TTL 60s: reabertura do dialog não gera novo round-trip.
 * - Graceful degradation: se attachments ou teamMembers falharem no
 *   backend, retornam vazios (o lead ainda é exibido).
 * - silent: true — re-fetch sem exibir loading spinner (para sync por realtime).
 */
export function useLeadDetails(
  leadId: string | null,
  teamId: string | null,
  supabaseId: string | undefined
): {
  details: LeadDetails | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => void;
} {
  const [details, setDetails] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestKeyRef = useRef<string | null>(null);

  const load = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      const force = options?.force ?? false;
      const silent = options?.silent ?? false;

      if (!leadId || !teamId || !supabaseId) {
        setDetails(null);
        setError(null);
        latestKeyRef.current = null;
        return;
      }

      const key = buildCacheKey(supabaseId, teamId, leadId);
      latestKeyRef.current = key;

      // Tentar servir do cache antes de exibir loading
      if (!force) {
        const cached = leadDetailsCacheByKey.get(key);
        if (
          cached &&
          Date.now() - cached.timestamp <= LEAD_DETAILS_CACHE_TTL_MS
        ) {
          setDetails(cached.details);
          setError(null);
          return;
        }
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await loadLeadDetailsWithDedupe(
          supabaseId,
          teamId,
          leadId,
          force
        );

        if (latestKeyRef.current !== key) return;

        setDetails(result);
        setError(null);
      } catch (loadError) {
        if (latestKeyRef.current !== key) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Erro ao carregar detalhes do lead"
        );
      } finally {
        if (!silent && latestKeyRef.current === key) {
          setLoading(false);
        }
      }
    },
    [leadId, teamId, supabaseId]
  );

  useEffect(() => {
    // Limpar estado ao mudar de lead
    setDetails(null);
    setError(null);
    void load();
  }, [load]);

  const refresh = useCallback(
    (options?: { silent?: boolean }) => {
      if (leadId && teamId && supabaseId) {
        invalidateLeadDetailsCache(supabaseId, teamId, leadId);
      }
      void load({ force: true, silent: options?.silent });
    },
    [load, leadId, teamId, supabaseId]
  );

  return { details, loading, error, refresh };
}
