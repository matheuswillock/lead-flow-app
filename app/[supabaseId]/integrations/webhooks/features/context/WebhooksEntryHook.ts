"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { teamWebhooksService } from "../services/TeamWebhooksService";
import type { WebhookDirectionSummary, WebhooksEntryActions, WebhooksEntryState } from "./WebhooksEntryTypes";

const EMPTY_SUMMARY: WebhookDirectionSummary = { total: 0, active: 0, paused: 0 };

const buildKey = (supabaseId: string, teamId: string) => `${supabaseId}:${teamId}`;

export function useWebhooksEntry(supabaseId: string): WebhooksEntryState & WebhooksEntryActions {
  const { activeTeamId } = useTeamContext();
  const [inboundSummary, setInboundSummary] = useState<WebhookDirectionSummary>(EMPTY_SUMMARY);
  const [outboundSummary, setOutboundSummary] = useState<WebhookDirectionSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inFlightKeyRef = useRef<string | null>(null);
  const lastSuccessfulKeyRef = useRef<string | null>(null);
  const currentKeyRef = useRef<string | null>(null);

  const loadSummary = useCallback(
    async (options?: { force?: boolean }) => {
      if (!activeTeamId) {
        currentKeyRef.current = null;
        inFlightKeyRef.current = null;
        lastSuccessfulKeyRef.current = null;
        setInboundSummary(EMPTY_SUMMARY);
        setOutboundSummary(EMPTY_SUMMARY);
        setLoading(false);
        return;
      }

      const requestKey = buildKey(supabaseId, activeTeamId);
      const forceReload = options?.force === true;
      currentKeyRef.current = requestKey;

      if (!forceReload && lastSuccessfulKeyRef.current === requestKey) {
        // R15-20: sem isso, voltar para um time cujo fetch já resolveu antes
        // (com `loading` ainda `true` por causa de um outro time que ficou
        // pendente no meio da troca) deixava o card preso no Skeleton para
        // sempre — o fetch pendente do outro time nunca zera `loading` aqui,
        // porque `currentKeyRef` já não bate com a chave dele quando resolve.
        setLoading(false);
        return;
      }
      if (inFlightKeyRef.current === requestKey) return;

      inFlightKeyRef.current = requestKey;
      setLoading(true);
      setError(false);

      try {
        const [inboundTotal, inboundActive, inboundPaused, outboundTotal, outboundActive, outboundPaused] =
          await Promise.all([
            teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1 }),
            teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1, status: "active" }),
            teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1, status: "paused" }),
            teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1 }),
            teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1, status: "active" }),
            teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1, status: "paused" }),
          ]);

        if (currentKeyRef.current !== requestKey) return;

        setInboundSummary({
          total: inboundTotal.total ?? 0,
          active: inboundActive.total ?? 0,
          paused: inboundPaused.total ?? 0,
        });
        setOutboundSummary({
          total: outboundTotal.total ?? 0,
          active: outboundActive.total ?? 0,
          paused: outboundPaused.total ?? 0,
        });
        lastSuccessfulKeyRef.current = requestKey;
      } catch (loadError) {
        console.error("[useWebhooksEntry] Erro ao carregar resumo de webhooks:", loadError);
        if (currentKeyRef.current === requestKey) {
          setInboundSummary(EMPTY_SUMMARY);
          setOutboundSummary(EMPTY_SUMMARY);
          setError(true);
        }
      } finally {
        if (currentKeyRef.current === requestKey) {
          setLoading(false);
        }
        if (inFlightKeyRef.current === requestKey) {
          inFlightKeyRef.current = null;
        }
      }
    },
    [activeTeamId, supabaseId]
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return {
    supabaseId,
    inboundSummary,
    outboundSummary,
    loading,
    error,
    reload: () => loadSummary({ force: true }),
  };
}
