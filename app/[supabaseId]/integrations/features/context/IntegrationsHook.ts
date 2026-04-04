"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import { integrationsService } from "../services/IntegrationsService";
import type { IntegrationsState, IntegrationsActions } from "./IntegrationsTypes";

const STUDIO_WEBHOOK_CONTRACT_JSON = `{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "phone": "+5511999999999",
  "cnpj": "12.345.678/0001-95",
  "ages": "36, 32, 13",
  "current_health_plan": "Unimed",
  "current_value": 850.5,
  "reference_hospital": "Hospital Albert Einstein",
  "current_treatment": "Cardiology follow-up",
  "source": "n8n",
  "metadata": {
    "ad_id": "{{1.ad_id}}",
    "page_id": "{{1.page_id}}",
    "lead_id": "{{1.lead_id}}",
    "created_time": "{{1.created_time}}",
    "form_name": "{{1.form_name}}"
  }
}`;

export function useIntegrations(supabaseId: string): IntegrationsState & IntegrationsActions {
  const { activeTeamId } = useTeamContext();
  const [studioWebhookConfig, setStudioWebhookConfig] = useState<IntegrationsState["studioWebhookConfig"]>(null);
  const [studioWebhookLoading, setStudioWebhookLoading] = useState(false);
  const [studioWebhookSaving, setStudioWebhookSaving] = useState(false);
  const [studioWebhookTokenMode, setStudioWebhookTokenMode] = useState<"manual" | "auto">("auto");
  const [studioWebhookManualToken, setStudioWebhookManualToken] = useState("");
  const [studioWebhookExpiryMode, setStudioWebhookExpiryMode] = useState<"hours_24" | "months_6" | "indeterminate">("months_6");
  const [studioWebhookGeneratedUrl, setStudioWebhookGeneratedUrl] = useState("");

  const appUrl = useMemo(() => integrationsService.resolveAppUrl(), []);

  const leadFormUrl = useMemo(() => {
    if (!activeTeamId) return "";
    return integrationsService.buildLeadFormUrl({
      appUrl,
      teamId: activeTeamId,
    });
  }, [appUrl, activeTeamId]);

  const loadStudioWebhookConfig = useCallback(() => {
    const executeLoad = async () => {
      if (!activeTeamId) {
        setStudioWebhookConfig(null);
        return;
      }

      setStudioWebhookLoading(true);
      try {
        const config = await integrationsService.getStudioWebhookConfig(supabaseId, activeTeamId);
        setStudioWebhookConfig(config);
        setStudioWebhookExpiryMode(config.expiryMode);
      } catch (error) {
        console.error("[useIntegrations] Erro ao carregar configuração do webhook:", error);
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar o webhook");
      } finally {
        setStudioWebhookLoading(false);
      }
    };

    executeLoad().catch((error) => {
      console.error("[useIntegrations] Erro inesperado ao carregar webhook:", error);
      setStudioWebhookLoading(false);
    });
  }, [activeTeamId, supabaseId]);

  useEffect(() => {
    loadStudioWebhookConfig();
  }, [loadStudioWebhookConfig]);

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

  const saveStudioWebhookConfig = useCallback(() => {
    const executeSave = async () => {
      if (!activeTeamId) {
        toast.error("Selecione um time para configurar o webhook");
        return;
      }

      if (studioWebhookTokenMode === "manual" && !studioWebhookManualToken.trim()) {
        toast.error("Informe um token manual ou selecione token automático");
        return;
      }

      setStudioWebhookSaving(true);

      try {
        const result = await integrationsService.saveStudioWebhookConfig(supabaseId, {
          teamId: activeTeamId,
          tokenMode: studioWebhookTokenMode,
          manualToken: studioWebhookTokenMode === "manual" ? studioWebhookManualToken.trim() : undefined,
          expiryMode: studioWebhookExpiryMode,
        });

        setStudioWebhookGeneratedUrl(result.webhookUrl);
        setStudioWebhookConfig({
          configured: result.configured,
          tokenPreview: result.tokenPreview,
          expiryMode: result.expiryMode,
          expiresAt: result.expiresAt,
          isExpired: result.isExpired,
          lastUsedAt: result.lastUsedAt,
          webhookUrlTemplate: result.webhookUrlTemplate,
        });
        setStudioWebhookManualToken("");
        toast.success("Webhook configurado com sucesso");
      } catch (error) {
        console.error("[useIntegrations] Erro ao salvar webhook:", error);
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o webhook");
      } finally {
        setStudioWebhookSaving(false);
      }
    };

    executeSave().catch((error) => {
      console.error("[useIntegrations] Erro inesperado ao salvar webhook:", error);
      setStudioWebhookSaving(false);
    });
  }, [
    activeTeamId,
    studioWebhookTokenMode,
    studioWebhookManualToken,
    studioWebhookExpiryMode,
    supabaseId,
  ]);

  const copyStudioWebhookUrl = useCallback(() => {
    const executeCopy = async () => {
      const webhookUrlToCopy = studioWebhookGeneratedUrl || studioWebhookConfig?.webhookUrlTemplate || "";

      if (!webhookUrlToCopy) {
        toast.error("Configure o webhook para obter a URL");
        return;
      }

      const copied = await integrationsService.copyToClipboard(webhookUrlToCopy);
      if (!copied) {
        toast.error("Não foi possível copiar a URL do webhook");
        return;
      }

      if (webhookUrlToCopy.includes("[token]")) {
        toast.success("URL template copiada!");
        return;
      }

      toast.success("URL do webhook copiada!");
    };

    executeCopy().catch((error) => {
      console.error("[useIntegrations] Erro inesperado ao copiar URL do webhook:", error);
      toast.error("Não foi possível copiar a URL do webhook");
    });
  }, [studioWebhookGeneratedUrl, studioWebhookConfig?.webhookUrlTemplate]);

  const copyStudioWebhookContract = useCallback(() => {
    const executeCopy = async () => {
      const copied = await integrationsService.copyToClipboard(STUDIO_WEBHOOK_CONTRACT_JSON);
      if (copied) {
        toast.success("Modelo JSON copiado!");
        return;
      }

      toast.error("Não foi possível copiar o modelo JSON");
    };

    executeCopy().catch((error) => {
      console.error("[useIntegrations] Erro ao copiar contrato JSON:", error);
      toast.error("Não foi possível copiar o modelo JSON");
    });
  }, []);

  return {
    supabaseId,
    leadFormUrl,
    activeTeamId,
    studioWebhookConfig,
    studioWebhookTokenMode,
    studioWebhookManualToken,
    studioWebhookExpiryMode,
    studioWebhookGeneratedUrl,
    studioWebhookLoading,
    studioWebhookSaving,
    studioWebhookContractJson: STUDIO_WEBHOOK_CONTRACT_JSON,
    copyLeadFormUrl,
    loadStudioWebhookConfig,
    setStudioWebhookTokenMode,
    setStudioWebhookManualToken,
    setStudioWebhookExpiryMode,
    saveStudioWebhookConfig,
    copyStudioWebhookUrl,
    copyStudioWebhookContract,
  };
}
