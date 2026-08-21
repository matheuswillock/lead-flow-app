"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { useTeamContext } from "@/app/context/TeamContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { integrationsService } from "../services/IntegrationsService";
import type { IntegrationsState, IntegrationsActions } from "./IntegrationsTypes";
import type {
  IntegrationsBootstrapResponse,
  RadarPixelConfigData,
  RadarPixelHitLogItem,
  StudioWebhookLogItem,
} from "../services/IIntegrationsService";

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
const studioWebhookLogsInFlightByKey = new Map<string, Promise<StudioWebhookLogItem[]>>();
const studioWebhookLogsCacheByKey = new Map<string, StudioWebhookLogItem[]>();
const radarPixelConfigInFlightByKey = new Map<string, Promise<RadarPixelConfigData>>();
const radarPixelConfigCacheByKey = new Map<string, RadarPixelConfigData>();
const radarPixelLogsInFlightByKey = new Map<string, Promise<RadarPixelHitLogItem[]>>();
const radarPixelLogsCacheByKey = new Map<string, RadarPixelHitLogItem[]>();

const buildBootstrapKey = (supabaseId: string, teamId: string): string => `${supabaseId}:${teamId}`;

export function useIntegrations(supabaseId: string): IntegrationsState & IntegrationsActions {
  const { activeTeamId } = useTeamContext();
  const { hasAccess } = useFeatureAccess();
  const hasRadarAccess = hasAccess(FEATURE_SLUGS.RADAR);
  const [leadFormUrl, setLeadFormUrl] = useState("");
  const [studioWebhookConfig, setStudioWebhookConfig] = useState<IntegrationsState["studioWebhookConfig"]>(null);
  const [integrationsBootstrapLoading, setIntegrationsBootstrapLoading] = useState(false);
  const [studioWebhookLoading, setStudioWebhookLoading] = useState(false);
  const [studioWebhookSaving, setStudioWebhookSaving] = useState(false);
  const [studioWebhookLogs, setStudioWebhookLogs] = useState<StudioWebhookLogItem[]>([]);
  const [studioWebhookLogsLoading, setStudioWebhookLogsLoading] = useState(false);
  const [selectedStudioWebhookLogId, setSelectedStudioWebhookLogId] = useState<string | null>(null);
  const [studioWebhookTokenMode, setStudioWebhookTokenMode] = useState<"manual" | "auto" | "none">("auto");
  const [studioWebhookManualToken, setStudioWebhookManualToken] = useState("");
  const [studioWebhookExpiryMode, setStudioWebhookExpiryMode] = useState<"hours_24" | "months_6" | "indeterminate">("months_6");
  const [studioWebhookGeneratedUrl, setStudioWebhookGeneratedUrl] = useState("");
  const [radarPixelConfig, setRadarPixelConfig] = useState<IntegrationsState["radarPixelConfig"]>(null);
  const [radarPixelAllowedOriginsInput, setRadarPixelAllowedOriginsInput] = useState("");
  const [radarPixelLoading, setRadarPixelLoading] = useState(false);
  const [radarPixelSaving, setRadarPixelSaving] = useState(false);
  const [radarPixelDeleting, setRadarPixelDeleting] = useState(false);
  const [radarPixelHitLogs, setRadarPixelHitLogs] = useState<RadarPixelHitLogItem[]>([]);
  const [radarPixelHitLogsLoading, setRadarPixelHitLogsLoading] = useState(false);
  const [selectedRadarPixelHitLogId, setSelectedRadarPixelHitLogId] = useState<string | null>(null);
  const inFlightBootstrapKeyRef = useRef<string | null>(null);
  const lastSuccessfulBootstrapKeyRef = useRef<string | null>(null);
  const currentBootstrapKeyRef = useRef<string | null>(null);
  const inFlightLogsKeyRef = useRef<string | null>(null);
  const lastSuccessfulLogsKeyRef = useRef<string | null>(null);
  const currentLogsKeyRef = useRef<string | null>(null);
  const inFlightPixelConfigKeyRef = useRef<string | null>(null);
  const lastSuccessfulPixelConfigKeyRef = useRef<string | null>(null);
  const currentPixelConfigKeyRef = useRef<string | null>(null);
  const inFlightPixelLogsKeyRef = useRef<string | null>(null);
  const lastSuccessfulPixelLogsKeyRef = useRef<string | null>(null);
  const currentPixelLogsKeyRef = useRef<string | null>(null);

  const resetBootstrapState = useCallback(() => {
    setLeadFormUrl("");
    setStudioWebhookConfig(null);
    setStudioWebhookTokenMode("auto");
    setStudioWebhookExpiryMode("months_6");
    setStudioWebhookManualToken("");
    setStudioWebhookGeneratedUrl("");
  }, []);

  const resetLogsState = useCallback(() => {
    setStudioWebhookLogs([]);
    setSelectedStudioWebhookLogId(null);
    setStudioWebhookLogsLoading(false);
  }, []);

  const applyWebhookLogs = useCallback((logs: StudioWebhookLogItem[]) => {
    setStudioWebhookLogs(logs);
    setSelectedStudioWebhookLogId((currentSelectedLogId) => {
      if (currentSelectedLogId && logs.some((log) => log.id === currentSelectedLogId)) {
        return currentSelectedLogId;
      }

      return logs[0]?.id ?? null;
    });
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
      currentLogsKeyRef.current = null;
      inFlightLogsKeyRef.current = null;
      lastSuccessfulLogsKeyRef.current = null;
      setIntegrationsBootstrapLoading(false);
      setStudioWebhookLoading(false);
      resetBootstrapState();
      resetLogsState();
      return;
    }

    const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
    currentBootstrapKeyRef.current = requestKey;

    if (lastSuccessfulBootstrapKeyRef.current === requestKey) {
      setIntegrationsBootstrapLoading(false);
      setStudioWebhookLoading(false);
      return;
    }

    if (inFlightBootstrapKeyRef.current === requestKey) {
      return;
    }

    const cachedBootstrap = integrationsBootstrapCacheByKey.get(requestKey);
    if (cachedBootstrap) {
      applyBootstrapResult(cachedBootstrap);
      lastSuccessfulBootstrapKeyRef.current = requestKey;
      setIntegrationsBootstrapLoading(false);
      setStudioWebhookLoading(false);
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
      toastUserError(error);
    } finally {
      if (currentBootstrapKeyRef.current === requestKey) {
        setIntegrationsBootstrapLoading(false);
        setStudioWebhookLoading(false);
      }
      if (inFlightBootstrapKeyRef.current === requestKey) {
        inFlightBootstrapKeyRef.current = null;
      }
    }
  }, [activeTeamId, applyBootstrapResult, resetBootstrapState, resetLogsState, supabaseId]);

  useEffect(() => {
    void loadStudioWebhookConfig();
  }, [loadStudioWebhookConfig]);

  const loadStudioWebhookLogs = useCallback(
    async (options?: { force?: boolean }) => {
      if (!activeTeamId) {
        currentLogsKeyRef.current = null;
        inFlightLogsKeyRef.current = null;
        lastSuccessfulLogsKeyRef.current = null;
        resetLogsState();
        return;
      }

      const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
      const forceReload = options?.force === true;
      const previousKey = currentLogsKeyRef.current;
      currentLogsKeyRef.current = requestKey;

      if (previousKey && previousKey !== requestKey) {
        setStudioWebhookLogs([]);
        setSelectedStudioWebhookLogId(null);
      }

      if (!forceReload && lastSuccessfulLogsKeyRef.current === requestKey) {
        return;
      }

      if (inFlightLogsKeyRef.current === requestKey) {
        return;
      }

      const cachedLogs = !forceReload ? studioWebhookLogsCacheByKey.get(requestKey) : undefined;
      if (cachedLogs) {
        applyWebhookLogs(cachedLogs);
        lastSuccessfulLogsKeyRef.current = requestKey;
        setStudioWebhookLogsLoading(false);
        return;
      }

      setStudioWebhookLogsLoading(true);
      inFlightLogsKeyRef.current = requestKey;

      const existingRequest = studioWebhookLogsInFlightByKey.get(requestKey);
      const requestPromise =
        existingRequest ??
        integrationsService
          .getStudioWebhookLogs(supabaseId, activeTeamId)
          .then((result) => result.logs)
          .finally(() => {
            studioWebhookLogsInFlightByKey.delete(requestKey);
          });

      if (!existingRequest) {
        studioWebhookLogsInFlightByKey.set(requestKey, requestPromise);
      }

      try {
        const logs = await requestPromise;
        studioWebhookLogsCacheByKey.set(requestKey, logs);

        if (currentLogsKeyRef.current !== requestKey) {
          return;
        }

        applyWebhookLogs(logs);
        lastSuccessfulLogsKeyRef.current = requestKey;
      } catch (error) {
        if (currentLogsKeyRef.current === requestKey) {
          resetLogsState();
        }
        console.error("[useIntegrations] Erro ao carregar logs do webhook:", error);
        toastUserError(error);
      } finally {
        if (currentLogsKeyRef.current === requestKey) {
          setStudioWebhookLogsLoading(false);
        }
        if (inFlightLogsKeyRef.current === requestKey) {
          inFlightLogsKeyRef.current = null;
        }
      }
    },
    [activeTeamId, applyWebhookLogs, resetLogsState, supabaseId]
  );

  useEffect(() => {
    void loadStudioWebhookLogs({ force: true });
  }, [activeTeamId, loadStudioWebhookLogs]);

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
        toastUserError(error);
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

  const loadRadarPixelConfig = useCallback(async () => {
    if (!hasRadarAccess || !activeTeamId) {
      currentPixelConfigKeyRef.current = null;
      inFlightPixelConfigKeyRef.current = null;
      lastSuccessfulPixelConfigKeyRef.current = null;
      setRadarPixelConfig(null);
      setRadarPixelLoading(false);
      return;
    }

    const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
    currentPixelConfigKeyRef.current = requestKey;

    if (lastSuccessfulPixelConfigKeyRef.current === requestKey) {
      setRadarPixelLoading(false);
      return;
    }

    if (inFlightPixelConfigKeyRef.current === requestKey) {
      return;
    }

    const cached = radarPixelConfigCacheByKey.get(requestKey);
    if (cached) {
      setRadarPixelConfig(cached);
      setRadarPixelAllowedOriginsInput(cached.allowedOrigins.join("\n"));
      lastSuccessfulPixelConfigKeyRef.current = requestKey;
      setRadarPixelLoading(false);
      return;
    }

    setRadarPixelLoading(true);
    inFlightPixelConfigKeyRef.current = requestKey;

    const existingRequest = radarPixelConfigInFlightByKey.get(requestKey);
    const requestPromise =
      existingRequest ??
      integrationsService.getRadarPixelConfig(supabaseId, activeTeamId).finally(() => {
        radarPixelConfigInFlightByKey.delete(requestKey);
      });

    if (!existingRequest) {
      radarPixelConfigInFlightByKey.set(requestKey, requestPromise);
    }

    try {
      const config = await requestPromise;
      radarPixelConfigCacheByKey.set(requestKey, config);

      if (currentPixelConfigKeyRef.current !== requestKey) return;

      setRadarPixelConfig(config);
      setRadarPixelAllowedOriginsInput(config.allowedOrigins.join("\n"));
      lastSuccessfulPixelConfigKeyRef.current = requestKey;
    } catch (error) {
      if (currentPixelConfigKeyRef.current === requestKey) {
        setRadarPixelConfig(null);
      }
      console.error("[useIntegrations] Erro ao carregar configuração do pixel:", error);
      toastUserError(error);
    } finally {
      if (currentPixelConfigKeyRef.current === requestKey) {
        setRadarPixelLoading(false);
      }
      if (inFlightPixelConfigKeyRef.current === requestKey) {
        inFlightPixelConfigKeyRef.current = null;
      }
    }
  }, [activeTeamId, hasRadarAccess, supabaseId]);

  useEffect(() => {
    void loadRadarPixelConfig();
  }, [loadRadarPixelConfig]);

  useEffect(() => {
    setRadarPixelSaving(false);
    setRadarPixelDeleting(false);
  }, [activeTeamId]);

  const loadRadarPixelHitLogs = useCallback(
    async (options?: { force?: boolean }) => {
      if (!hasRadarAccess || !activeTeamId) {
        currentPixelLogsKeyRef.current = null;
        inFlightPixelLogsKeyRef.current = null;
        lastSuccessfulPixelLogsKeyRef.current = null;
        setRadarPixelHitLogs([]);
        setSelectedRadarPixelHitLogId(null);
        setRadarPixelHitLogsLoading(false);
        return;
      }

      const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
      const forceReload = options?.force === true;
      currentPixelLogsKeyRef.current = requestKey;

      if (!forceReload && lastSuccessfulPixelLogsKeyRef.current === requestKey) return;
      if (inFlightPixelLogsKeyRef.current === requestKey) return;

      const cachedLogs = !forceReload ? radarPixelLogsCacheByKey.get(requestKey) : undefined;
      if (cachedLogs) {
        setRadarPixelHitLogs(cachedLogs);
        setSelectedRadarPixelHitLogId((cur) =>
          cur && cachedLogs.some((l) => l.id === cur) ? cur : (cachedLogs[0]?.id ?? null)
        );
        lastSuccessfulPixelLogsKeyRef.current = requestKey;
        setRadarPixelHitLogsLoading(false);
        return;
      }

      setRadarPixelHitLogsLoading(true);
      inFlightPixelLogsKeyRef.current = requestKey;

      const existingRequest = radarPixelLogsInFlightByKey.get(requestKey);
      const requestPromise =
        existingRequest ??
        integrationsService
          .getRadarPixelHitLogs(supabaseId, activeTeamId)
          .then((result) => result.logs)
          .finally(() => {
            radarPixelLogsInFlightByKey.delete(requestKey);
          });

      if (!existingRequest) {
        radarPixelLogsInFlightByKey.set(requestKey, requestPromise);
      }

      try {
        const logs = await requestPromise;
        radarPixelLogsCacheByKey.set(requestKey, logs);

        if (currentPixelLogsKeyRef.current !== requestKey) return;

        setRadarPixelHitLogs(logs);
        setSelectedRadarPixelHitLogId((cur) =>
          cur && logs.some((l) => l.id === cur) ? cur : (logs[0]?.id ?? null)
        );
        lastSuccessfulPixelLogsKeyRef.current = requestKey;
      } catch (error) {
        if (currentPixelLogsKeyRef.current === requestKey) {
          setRadarPixelHitLogs([]);
        }
        console.error("[useIntegrations] Erro ao carregar logs do pixel:", error);
        toastUserError(error);
      } finally {
        if (currentPixelLogsKeyRef.current === requestKey) {
          setRadarPixelHitLogsLoading(false);
        }
        if (inFlightPixelLogsKeyRef.current === requestKey) {
          inFlightPixelLogsKeyRef.current = null;
        }
      }
    },
    [activeTeamId, hasRadarAccess, supabaseId]
  );

  useEffect(() => {
    void loadRadarPixelHitLogs({ force: true });
  }, [activeTeamId, loadRadarPixelHitLogs]);

  const saveRadarPixelConfig = useCallback(() => {
    const executeSave = async () => {
      if (!activeTeamId) {
        toast.error("Selecione um time para configurar o pixel");
        return;
      }

      const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
      setRadarPixelSaving(true);

      try {
        const allowedOrigins = radarPixelAllowedOriginsInput
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        const config = await integrationsService.saveRadarPixelConfig(supabaseId, activeTeamId, { allowedOrigins });

        radarPixelConfigCacheByKey.set(requestKey, config);

        if (currentPixelConfigKeyRef.current !== requestKey) return;

        lastSuccessfulPixelConfigKeyRef.current = requestKey;

        setRadarPixelConfig(config);
        setRadarPixelAllowedOriginsInput(config.allowedOrigins.join("\n"));
        toast.success("Pixel configurado com sucesso");
      } catch (error) {
        console.error("[useIntegrations] Erro ao salvar pixel:", error);
        toastUserError(error);
      } finally {
        if (currentPixelConfigKeyRef.current === requestKey) {
          setRadarPixelSaving(false);
        }
      }
    };

    executeSave().catch((error) => {
      console.error("[useIntegrations] Erro inesperado ao salvar pixel:", error);
      setRadarPixelSaving(false);
    });
  }, [activeTeamId, radarPixelAllowedOriginsInput, supabaseId]);

  const deleteRadarPixelConfig = useCallback(() => {
    const executeDelete = async () => {
      if (!activeTeamId) return;

      const requestKey = buildBootstrapKey(supabaseId, activeTeamId);
      setRadarPixelDeleting(true);

      try {
        await integrationsService.deleteRadarPixelConfig(supabaseId, activeTeamId);

        radarPixelConfigCacheByKey.delete(requestKey);

        if (currentPixelConfigKeyRef.current !== requestKey) return;

        lastSuccessfulPixelConfigKeyRef.current = null;

        setRadarPixelConfig(null);
        setRadarPixelAllowedOriginsInput("");
        toast.success("Pixel removido com sucesso");
      } catch (error) {
        console.error("[useIntegrations] Erro ao remover pixel:", error);
        toastUserError(error);
      } finally {
        if (currentPixelConfigKeyRef.current === requestKey) {
          setRadarPixelDeleting(false);
        }
      }
    };

    executeDelete().catch((error) => {
      console.error("[useIntegrations] Erro inesperado ao remover pixel:", error);
      setRadarPixelDeleting(false);
    });
  }, [activeTeamId, supabaseId]);

  const copyRadarPixelSnippet = useCallback(() => {
    const executeCopy = async () => {
      const snippet = radarPixelConfig?.pixelSnippet;
      if (!snippet) {
        toast.error("Configure o pixel para obter o snippet");
        return;
      }

      const copied = await integrationsService.copyToClipboard(snippet);
      if (copied) {
        toast.success("Snippet copiado!");
        return;
      }

      toast.error("Não foi possível copiar o snippet");
    };

    executeCopy().catch((error) => {
      console.error("[useIntegrations] Erro ao copiar snippet do pixel:", error);
      toast.error("Não foi possível copiar o snippet");
    });
  }, [radarPixelConfig?.pixelSnippet]);

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
    studioWebhookLogs,
    studioWebhookLogsLoading,
    selectedStudioWebhookLogId,
    studioWebhookContractJson: STUDIO_WEBHOOK_CONTRACT_JSON,
    radarPixelConfig,
    radarPixelAllowedOriginsInput,
    radarPixelLoading,
    radarPixelSaving,
    radarPixelDeleting,
    radarPixelHitLogs,
    radarPixelHitLogsLoading,
    selectedRadarPixelHitLogId,
    copyLeadFormUrl,
    loadStudioWebhookConfig,
    loadStudioWebhookLogs,
    setStudioWebhookTokenMode,
    setStudioWebhookManualToken,
    setStudioWebhookExpiryMode,
    setSelectedStudioWebhookLogId,
    saveStudioWebhookConfig,
    copyStudioWebhookUrl,
    copyStudioWebhookContract,
    loadRadarPixelConfig,
    loadRadarPixelHitLogs,
    setRadarPixelAllowedOriginsInput,
    setSelectedRadarPixelHitLogId,
    saveRadarPixelConfig,
    deleteRadarPixelConfig,
    copyRadarPixelSnippet,
  };
}
