"use client";

import { useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import { integrationsService } from "../services/IntegrationsService";
import type { IntegrationsState, IntegrationsActions } from "./IntegrationsTypes";

export function useIntegrations(supabaseId: string): IntegrationsState & IntegrationsActions {
  const { activeTeamId } = useTeamContext();

  const appUrl = useMemo(() => integrationsService.resolveAppUrl(), []);

  const leadFormUrl = useMemo(() => {
    if (!activeTeamId) return "";
    return integrationsService.buildLeadFormUrl({
      appUrl,
      teamId: activeTeamId,
    });
  }, [appUrl, activeTeamId]);

  const copyLeadFormUrl = useCallback(() => {
    const executeCopy = async () => {
      if (!leadFormUrl) {
        toast.error("Selecione um time para gerar a URL");
        return;
      }

      const copied = await integrationsService.copyToClipboard(leadFormUrl);
      if (copied) {
        toast.success("URL copiada!");
        return;
      }

      toast.error("Não foi possível copiar a URL");
    };

    executeCopy().catch((error) => {
      console.error("[useIntegrations] Erro inesperado ao copiar URL:", error);
      toast.error("Não foi possível copiar a URL");
    });
  }, [leadFormUrl]);

  return {
    supabaseId,
    leadFormUrl,
    copyLeadFormUrl,
  };
}
