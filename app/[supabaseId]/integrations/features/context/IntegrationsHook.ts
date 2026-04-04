"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import { integrationsService } from "../services/IntegrationsService";
import type { IntegrationsState, IntegrationsActions } from "./IntegrationsTypes";
import type { IntegrationsBootstrapResponse } from "../services/IIntegrationsService";

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

const integrationsBootstrapInFlightByKey = new Map<string, Promise<IntegrationsBootstrapResponse>>();
const integrationsBootstrapCacheByKey = new Map<string, IntegrationsBootstrapResponse>();

const buildBootstrapKey = (supabaseId: string, teamId: string): string => `${supabaseId}:${teamId}`;

export function useIntegrations(supabaseId: string): IntegrationsState & IntegrationsActions {
  const { activeTeamId } = useTeamContext();
  const [leadFormUrl, setLeadFormUrl] = useState("");
  const [studioWebhookConfig, setStudioWebhookConfig] = useState<IntegrationsState["studioWebhookConfig"]>(null);
  const [integrationsBootstrapLoading, setIntegrationsBootstrapLoading] = useState(false);
  const [studioWebhookLoading, setStudioWebhookLoading] = useState(false);
  const [studioWebhookSaving, setStudioWebhookSaving] = useState(false);
  const [studioWebhookTokenMode, setStudioWebhookTokenMode] = useState<"manual" | "auto" | "none">("auto");
  const [studioWebhookManualToken, setStudioWebhookManualToken] = useState("");
  const [studioWebhookExpiryMode, setStudioWebhookExpiryMode] = useState<"hours_24" | "months_6" | "indeterminate">("months_6");
  const [studioWebhookGeneratedUrl, setStudioWebhookGeneratedUrl] = useState("");
  const inFlightBootstrapKeyRef = useRef<string | null>(null);
  const lastSuccessfulBootstrapKeyRef = useRef<string | null>(null);
  const currentBootstrapKeyRef = useRef<string | null>(null);

  const resetBootstrapState = useCallback(() => {
    setLeadFormUrl("");
    setStudioWebhookConfig(null);
    setStudioWebhookTokenMode("auto");
    setStudioWebhookExpiryMode("months_6");
    setStudioWebhookManualToken("");
    setStudioWebhookGeneratedUrl("");
  }, []);

  const applyBootstrapResult = useCallback((bootstrap: IntegrationsBootstrapResponse) => {
    setLeadFormUrl(bootstrap.leadFormUrl);
    setStudioWebhookConfig({
      configured: bootstrap.configured,
      tokenMode: bootstrap.tokenMode,
      tokenPreview: bootstrap.tokenPreview,
      expiryMode: bootstrap.expiryMode,
      expiresAt: bootstrap.expiresAt,
      isExpired: bootstrap.isExpired,
      lastUsedAt: bootstrap.lastUsedAt,
      webhookUrl: bootstrap.webhookUrl,
      webhookUrlTemplate: bootstrap.webhookUrlTemplate,
    });
    setStudioWebhookTokenMode(bootstrap.tokenMode);
    setStudioWebhookExpiryMode(bootstrap.expiryMode);
    setStudioWebhookManualToken("");
    setStudioWebhookGeneratedUrl("");
  }, []);

  const loadStudioWebhookConfig = useCallback(async () => {
    if (!activeTeamId) {
      currentBootstrapKeyRef.current = null;
      inFlightBootstrapKeyRef.current = null;
      lastSuccessfulBootstrapKeyRef.current = null;
      setIntegrationsBootstrapLoading(false);
      setStudioWebhookLoading(false);
      resetBootstrapState();
      return;
    }

    const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
    currentBootstrapKeyRef.current = requestKey;

    if (lastSuccessfulBootstrapKeyRef.current === requestKey) {
      return;
    }

    if (inFlightBootstrapKeyRef.current === requestKey) {
      return;
    }

    const cachedBootstrap = integrationsBootstrapCacheByKey.get(requestKey);
    if (cachedBootstrap) {
      applyBootstrapResult(cachedBootstrap);
      lastSuccessfulBootstrapKeyRef.current = requestKey;
      return;
    }

    setIntegrationsBootstrapLoading(true);
    setStudioWebhookLoading(true);
    inFlightBootstrapKeyRef.current = requestKey;

    const existingRequest = integrationsBootstrapInFlightByKey.get(requestKey);
    const requestPromise =
      existingRequest ??
      integrationsService.getStudioWebhookConfig(supabaseId, activeTeamId).finally(() => {
        integrationsBootstrapInFlightByKey.delete(requestKey);
      });

    if (!existingRequest) {
      integrationsBootstrapInFlightByKey.set(requestKey, requestPromise);
    }

    try {
      const bootstrap = await requestPromise;
      integrationsBootstrapCacheByKey.set(requestKey, bootstrap);

      if (currentBootstrapKeyRef.current !== requestKey) {
        return;
      }

      applyBootstrapResult(bootstrap);
      lastSuccessfulBootstrapKeyRef.current = requestKey;
    } catch (error) {
      if (currentBootstrapKeyRef.current === requestKey) {
        resetBootstrapState();
      }
      console.error("[useIntegrations] Erro ao carregar configuração de integrações:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as integrações");
    } finally {
      if (currentBootstrapKeyRef.current === requestKey) {
        setIntegrationsBootstrapLoading(false);
        setStudioWebhookLoading(false);
      }
      if (inFlightBootstrapKeyRef.current === requestKey) {
        inFlightBootstrapKeyRef.current = null;
      }
    }
  }, [activeTeamId, applyBootstrapResult, resetBootstrapState, supabaseId]);

  useEffect(() => {
    void loadStudioWebhookConfig();
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
        const updatedWebhookConfig: IntegrationsState["studioWebhookConfig"] = {
          configured: result.configured,
          tokenMode: result.tokenMode,
          tokenPreview: result.tokenPreview,
          expiryMode: result.expiryMode,
          expiresAt: result.expiresAt,
          isExpired: result.isExpired,
          lastUsedAt: result.lastUsedAt,
          webhookUrl: result.webhookUrl,
          webhookUrlTemplate: result.webhookUrlTemplate,
        };
        setStudioWebhookConfig(updatedWebhookConfig);
        setStudioWebhookManualToken("");

        const bootstrapKey = buildBootstrapKey(supabaseId, activeTeamId);
        const cachedBootstrap = integrationsBootstrapCacheByKey.get(bootstrapKey);
        integrationsBootstrapCacheByKey.set(bootstrapKey, {
          leadFormUrl: cachedBootstrap?.leadFormUrl ?? leadFormUrl,
          configured: updatedWebhookConfig.configured,
          tokenMode: updatedWebhookConfig.tokenMode,
          tokenPreview: updatedWebhookConfig.tokenPreview,
          expiryMode: updatedWebhookConfig.expiryMode,
          expiresAt: updatedWebhookConfig.expiresAt,
          isExpired: updatedWebhookConfig.isExpired,
          lastUsedAt: updatedWebhookConfig.lastUsedAt,
          webhookUrl: updatedWebhookConfig.webhookUrl,
          webhookUrlTemplate: updatedWebhookConfig.webhookUrlTemplate,
        });
        lastSuccessfulBootstrapKeyRef.current = bootstrapKey;
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
    leadFormUrl,
    studioWebhookTokenMode,
    studioWebhookManualToken,
    studioWebhookExpiryMode,
    supabaseId,
  ]);

  const copyStudioWebhookUrl = useCallback(() => {
    const executeCopy = async () => {
      const webhookUrlToCopy =
        studioWebhookGeneratedUrl || studioWebhookConfig?.webhookUrl || studioWebhookConfig?.webhookUrlTemplate || "";

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
  }, [studioWebhookGeneratedUrl, studioWebhookConfig?.webhookUrl, studioWebhookConfig?.webhookUrlTemplate]);

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
    integrationsBootstrapLoading,
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
