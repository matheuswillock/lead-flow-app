"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { teamWebhooksService } from "../../webhooks/features/services/TeamWebhooksService";

export interface IntegrationsHubWebhooksSummary {
  totalCount: number;
  activeCount: number;
  loading: boolean;
  /** true quando a chamada falhou (ex.: 403 para quem não é manager) — não confundir com "zero webhooks". */
  error: boolean;
}

const EMPTY_SUMMARY: IntegrationsHubWebhooksSummary = { totalCount: 0, activeCount: 0, loading: false, error: false };

const buildKey = (supabaseId: string, teamId: string) => `${supabaseId}:${teamId}`;

/**
 * Resumo de webhooks (entrada + saída) para o card do hub de Integrações.
 * Reaproveita o `teamWebhooksService` já usado pelas listas de entrada/saída
 * (mesma feature, sem duplicar chamada HTTP nem estado).
 */
export function useIntegrationsHubWebhooksSummary(
  supabaseId: string,
  hasWebhooksAccess: boolean
): IntegrationsHubWebhooksSummary {
  const { activeTeamId } = useTeamContext();
  const [summary, setSummary] = useState<IntegrationsHubWebhooksSummary>(EMPTY_SUMMARY);
  const inFlightKeyRef = useRef<string | null>(null);
  const lastSuccessfulKeyRef = useRef<string | null>(null);
  const currentKeyRef = useRef<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!hasWebhooksAccess || !activeTeamId) {
      currentKeyRef.current = null;
      inFlightKeyRef.current = null;
      lastSuccessfulKeyRef.current = null;
      setSummary(EMPTY_SUMMARY);
      return;
    }

    const requestKey = buildKey(supabaseId, activeTeamId);
    currentKeyRef.current = requestKey;

    if (lastSuccessfulKeyRef.current === requestKey || inFlightKeyRef.current === requestKey) {
      return;
    }

    inFlightKeyRef.current = requestKey;
    setSummary((prev) => ({ ...prev, loading: true, error: false }));

    try {
      const [inboundTotal, outboundTotal, inboundActive, outboundActive] = await Promise.all([
        teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1 }),
        teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1 }),
        teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1, status: "active" }),
        teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1, status: "active" }),
      ]);

      if (currentKeyRef.current !== requestKey) return;

      setSummary({
        totalCount: (inboundTotal.total ?? 0) + (outboundTotal.total ?? 0),
        activeCount: (inboundActive.total ?? 0) + (outboundActive.total ?? 0),
        loading: false,
        error: false,
      });
      lastSuccessfulKeyRef.current = requestKey;
    } catch (loadError) {
      console.error("[useIntegrationsHubWebhooksSummary] Erro ao carregar resumo de webhooks:", loadError);
      if (currentKeyRef.current === requestKey) {
        setSummary({ ...EMPTY_SUMMARY, error: true });
      }
    } finally {
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null;
      }
    }
  }, [activeTeamId, hasWebhooksAccess, supabaseId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return summary;
}
