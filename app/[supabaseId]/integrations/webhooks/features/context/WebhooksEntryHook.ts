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

      if (!forceReload && lastSuccessfulKeyRef.current === requestKey) return;
      if (inFlightKeyRef.current === requestKey) return;

      inFlightKeyRef.current = requestKey;
      setLoading(true);

      try {
        const [inboundTotal, inboundActive, outboundTotal, outboundActive] = await Promise.all([
          teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1 }),
          teamWebhooksService.list(supabaseId, activeTeamId, { direction: "inbound", pageSize: 1, status: "active" }),
          teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1 }),
          teamWebhooksService.list(supabaseId, activeTeamId, { direction: "outbound", pageSize: 1, status: "active" }),
        ]);

        if (currentKeyRef.current !== requestKey) return;

        setInboundSummary({
          total: inboundTotal.total ?? 0,
          active: inboundActive.total ?? 0,
          paused: Math.max((inboundTotal.total ?? 0) - (inboundActive.total ?? 0), 0),
        });
        setOutboundSummary({
          total: outboundTotal.total ?? 0,
          active: outboundActive.total ?? 0,
          paused: Math.max((outboundTotal.total ?? 0) - (outboundActive.total ?? 0), 0),
        });
        lastSuccessfulKeyRef.current = requestKey;
      } catch (error) {
        console.error("[useWebhooksEntry] Erro ao carregar resumo de webhooks:", error);
        if (currentKeyRef.current === requestKey) {
          setInboundSummary(EMPTY_SUMMARY);
          setOutboundSummary(EMPTY_SUMMARY);
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
    reload: () => loadSummary({ force: true }),
  };
}
