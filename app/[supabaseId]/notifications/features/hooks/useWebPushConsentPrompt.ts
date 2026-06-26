"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { WEB_PUSH_CONSENT_VERSION } from "@/lib/web-push/constants";
import type { WebPushConsentSource } from "@/lib/web-push/types";
import { webPushNotificationsService } from "../services/WebPushNotificationsService";
import { useWebPushNotifications } from "./useWebPushNotifications";

type UseWebPushConsentPromptOptions = {
  supabaseId: string;
  source: WebPushConsentSource;
};

export function useWebPushConsentPrompt({ supabaseId, source }: UseWebPushConsentPromptOptions) {
  const { activeTeamId } = useTeamContext();
  const {
    permission,
    isEnabled,
    isLoading,
    isSupported,
    enable,
  } = useWebPushNotifications(supabaseId);

  const [isOpen, setIsOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [shouldPromptFromServer, setShouldPromptFromServer] = useState(false);
  const [hasCheckedConsent, setHasCheckedConsent] = useState(false);
  const fetchKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!supabaseId || !activeTeamId || !isSupported) {
      setHasCheckedConsent(true);
      return;
    }

    if (permission === "granted" && isEnabled) {
      setShouldPromptFromServer(false);
      setHasCheckedConsent(true);
      return;
    }

    const requestKey = `${supabaseId}:${activeTeamId}`;
    if (fetchKeyRef.current === requestKey || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    fetchKeyRef.current = requestKey;

    const loadConsent = async () => {
      try {
        const consent = await webPushNotificationsService.getConsent({
          supabaseId,
          teamId: activeTeamId,
        });
        setShouldPromptFromServer(consent.shouldPrompt);
      } catch (error) {
        console.error("[useWebPushConsentPrompt] Erro ao buscar consentimento:", error);
        setShouldPromptFromServer(false);
      } finally {
        inFlightRef.current = false;
        setHasCheckedConsent(true);
      }
    };

    void loadConsent();
  }, [activeTeamId, isEnabled, isSupported, permission, supabaseId]);

  useEffect(() => {
    if (!hasCheckedConsent || !isSupported) {
      setIsOpen(false);
      return;
    }

    if (permission === "granted" && isEnabled) {
      setIsOpen(false);
      return;
    }

    if (permission === "denied") {
      setIsOpen(false);
      return;
    }

    setIsOpen(shouldPromptFromServer);
  }, [hasCheckedConsent, isEnabled, isSupported, permission, shouldPromptFromServer]);

  const closePrompt = useCallback(() => {
    setIsOpen(false);
  }, []);

  const accept = useCallback(async () => {
    setIsResolving(true);
    try {
      await enable({ source });
      setShouldPromptFromServer(false);
      closePrompt();
    } finally {
      setIsResolving(false);
    }
  }, [closePrompt, enable, source]);

  const dismiss = useCallback(async () => {
    if (!supabaseId || !activeTeamId) return;

    setIsResolving(true);
    try {
      await webPushNotificationsService.recordConsent(
        { supabaseId, teamId: activeTeamId },
        {
          status: "dismissed",
          consentVersion: WEB_PUSH_CONSENT_VERSION,
          source,
        },
      );
      setShouldPromptFromServer(false);
      closePrompt();
    } catch (error) {
      console.error("[useWebPushConsentPrompt] Erro ao dispensar:", error);
    } finally {
      setIsResolving(false);
    }
  }, [activeTeamId, closePrompt, source, supabaseId]);

  const decline = useCallback(async () => {
    if (!supabaseId || !activeTeamId) return;

    setIsResolving(true);
    try {
      await webPushNotificationsService.recordConsent(
        { supabaseId, teamId: activeTeamId },
        {
          status: "declined",
          consentVersion: WEB_PUSH_CONSENT_VERSION,
          source,
        },
      );
      setShouldPromptFromServer(false);
      closePrompt();
    } catch (error) {
      console.error("[useWebPushConsentPrompt] Erro ao recusar:", error);
    } finally {
      setIsResolving(false);
    }
  }, [activeTeamId, closePrompt, source, supabaseId]);

  return {
    isOpen,
    isLoading: isLoading || isResolving,
    isSupported,
    permission,
    accept,
    dismiss,
    decline,
    closePrompt,
    setIsOpen,
  };
}
