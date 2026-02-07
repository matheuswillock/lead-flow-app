import { useCallback, useEffect, useState } from "react";
import type { IntegrationState, MetaLeadIntegration, WhatsAppIntegration, IntegrationTeamMember } from "./IntegrationTypes";
import { integrationService } from "../services/IntegrationService";

interface UseIntegrationHookProps {
  supabaseId: string;
  teamId?: string | null;
}

interface UseIntegrationHookReturn extends IntegrationState {
  refresh: () => Promise<void>;
  saveMetaIntegration: (payload: any) => Promise<void>;
  saveWhatsAppIntegration: (payload: any) => Promise<void>;
  testMetaIntegration: (pageId?: string | null) => Promise<{ pageId: string; totalForms: number } | null>;
  testWhatsAppIntegration: (phoneNumberId?: string | null) => Promise<{ phoneNumberId: string; displayPhoneNumber?: string; verifiedName?: string } | null>;
}

const initialState: IntegrationState = {
  metaIntegration: null,
  whatsAppIntegration: null,
  teamMembers: [],
  isLoading: false,
  error: null
};

export function useIntegrationHook({ supabaseId, teamId }: UseIntegrationHookProps): UseIntegrationHookReturn {
  const [state, setState] = useState<IntegrationState>(initialState);

  const refresh = useCallback(async () => {
    if (!supabaseId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [metaIntegrations, whatsappIntegrations, members] = await Promise.all([
        integrationService.getMetaIntegrations(supabaseId, teamId),
        integrationService.getWhatsAppIntegrations(supabaseId, teamId),
        integrationService.getTeamMembers(supabaseId, teamId)
      ]);

      setState({
        metaIntegration: metaIntegrations[0] || null,
        whatsAppIntegration: whatsappIntegrations[0] || null,
        teamMembers: members,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || "Erro ao carregar integrações"
      }));
    }
  }, [supabaseId, teamId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveMetaIntegration = useCallback(async (payload: any) => {
    if (!supabaseId) return;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const existing = state.metaIntegration;
      let updated: MetaLeadIntegration;
      if (existing) {
        updated = await integrationService.updateMetaIntegration(supabaseId, existing.id, payload);
      } else {
        updated = await integrationService.createMetaIntegration(supabaseId, payload);
      }

      setState((prev) => ({
        ...prev,
        metaIntegration: updated,
        isLoading: false,
        error: null
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || "Erro ao salvar integração Meta"
      }));
      throw error;
    }
  }, [supabaseId, state.metaIntegration]);

  const saveWhatsAppIntegration = useCallback(async (payload: any) => {
    if (!supabaseId) return;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const existing = state.whatsAppIntegration;
      let updated: WhatsAppIntegration;
      if (existing) {
        updated = await integrationService.updateWhatsAppIntegration(supabaseId, existing.id, payload);
      } else {
        updated = await integrationService.createWhatsAppIntegration(supabaseId, payload);
      }

      setState((prev) => ({
        ...prev,
        whatsAppIntegration: updated,
        isLoading: false,
        error: null
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || "Erro ao salvar integração WhatsApp"
      }));
      throw error;
    }
  }, [supabaseId, state.whatsAppIntegration]);

  const testMetaIntegration = useCallback(async (pageId?: string | null) => {
    try {
      return await integrationService.testMetaIntegration(supabaseId, pageId);
    } catch {
      return null;
    }
  }, [supabaseId]);

  const testWhatsAppIntegration = useCallback(async (phoneNumberId?: string | null) => {
    try {
      return await integrationService.testWhatsAppIntegration(supabaseId, phoneNumberId);
    } catch {
      return null;
    }
  }, [supabaseId]);

  return {
    ...state,
    refresh,
    saveMetaIntegration,
    saveWhatsAppIntegration,
    testMetaIntegration,
    testWhatsAppIntegration
  };
}
