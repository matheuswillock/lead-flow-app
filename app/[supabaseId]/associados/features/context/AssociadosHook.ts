'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import type { IAssociadosService } from "../services/IAssociadosService";
import type {
  AssociateProposalDetail,
  AssociadosData,
  AssociadosFiltersState,
  IAssociadosActions,
  IAssociadosState,
  LeadAttachmentOption,
} from "./AssociadosTypes";
import { DEFAULT_ASSOCIADOS_FILTERS } from "./AssociadosTypes";

interface UseAssociadosHookProps {
  supabaseId: string;
  teamId: string | null;
  service: IAssociadosService;
}

function buildListKey(teamId: string | null, filters: AssociadosFiltersState) {
  return JSON.stringify({ teamId, filters });
}

export function useAssociadosHook({
  supabaseId,
  teamId,
  service,
}: UseAssociadosHookProps): IAssociadosState & IAssociadosActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssociadosData | null>(null);
  const [filters, setFiltersState] = useState<AssociadosFiltersState>(DEFAULT_ASSOCIADOS_FILTERS);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<AssociateProposalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [leadAttachments, setLeadAttachments] = useState<LeadAttachmentOption[]>([]);

  const listInFlight = useRef(false);
  const lastListSuccessKey = useRef<string | null>(null);
  const detailInFlight = useRef(false);
  const lastDetailSuccessKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    const requestKey = buildListKey(teamId, filters);
    if (listInFlight.current || lastListSuccessKey.current === requestKey) return;

    listInFlight.current = true;
    try {
      setIsLoading(true);
      setError(null);
      const result = await service.listProposals(supabaseId, teamId, filters);
      setData(result);
      lastListSuccessKey.current = requestKey;
    } catch (loadError) {
      console.error("[useAssociadosHook] Error:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar propostas");
    } finally {
      setIsLoading(false);
      listInFlight.current = false;
    }
  }, [service, supabaseId, teamId, filters]);

  const loadDetail = useCallback(
    async (leadId: string, force = false) => {
      if (!teamId) return;
      const requestKey = `${teamId}:${leadId}`;
      if (detailInFlight.current || (!force && lastDetailSuccessKey.current === requestKey)) return;

      detailInFlight.current = true;
      try {
        setDetailLoading(true);
        setDetailError(null);
        const [detailResult, attachments] = await Promise.all([
          service.getDetail(supabaseId, teamId, leadId),
          service.listLeadAttachments(supabaseId, teamId, leadId).catch(() => [] as LeadAttachmentOption[]),
        ]);
        setDetail(detailResult);
        setLeadAttachments(attachments);
        lastDetailSuccessKey.current = requestKey;
      } catch (loadError) {
        console.error("[useAssociadosHook][detail]", loadError);
        setDetailError(loadError instanceof Error ? loadError.message : "Erro ao carregar detalhe");
      } finally {
        setDetailLoading(false);
        detailInFlight.current = false;
      }
    },
    [service, supabaseId, teamId]
  );

  useEffect(() => {
    lastListSuccessKey.current = null;
    void load();
  }, [load]);

  const setFilters = useCallback((patch: Partial<AssociadosFiltersState>) => {
    lastListSuccessKey.current = null;
    setFiltersState((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  }, []);

  const openLead = useCallback(
    (leadId: string) => {
      setSelectedLeadId(leadId);
      setDrawerOpen(true);
      lastDetailSuccessKey.current = null;
      void loadDetail(leadId, true);
    },
    [loadDetail]
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedLeadId(null);
    setDetail(null);
    setLeadAttachments([]);
    setDetailError(null);
    lastDetailSuccessKey.current = null;
  }, []);

  const reloadDetail = useCallback(async () => {
    if (!selectedLeadId) return;
    lastDetailSuccessKey.current = null;
    await loadDetail(selectedLeadId, true);
  }, [loadDetail, selectedLeadId]);

  const afterMutation = useCallback(async () => {
    lastListSuccessKey.current = null;
    await load();
    if (selectedLeadId) {
      lastDetailSuccessKey.current = null;
      await loadDetail(selectedLeadId, true);
    }
  }, [load, loadDetail, selectedLeadId]);

  const criticize = useCallback(
    async (input: { title: string; message: string }) => {
      if (!teamId || !selectedLeadId) return;
      await service.criticize(supabaseId, teamId, selectedLeadId, input);
      await afterMutation();
    },
    [service, supabaseId, teamId, selectedLeadId, afterMutation]
  );

  const registerSale = useCallback(
    async (input: {
      operatorName: string;
      proposalNumber?: string;
      notes?: string;
      attachmentIds?: string[];
    }) => {
      if (!teamId || !selectedLeadId) return;
      await service.registerSale(supabaseId, teamId, selectedLeadId, input);
      closeDrawer();
      lastListSuccessKey.current = null;
      await load();
    },
    [service, supabaseId, teamId, selectedLeadId, closeDrawer, load]
  );

  const approveDocument = useCallback(
    async (documentType: Parameters<IAssociadosService["approveDocument"]>[3]) => {
      if (!teamId || !selectedLeadId) return;
      await service.approveDocument(supabaseId, teamId, selectedLeadId, documentType);
      await afterMutation();
    },
    [service, supabaseId, teamId, selectedLeadId, afterMutation]
  );

  const rejectDocument = useCallback(
    async (
      documentType: Parameters<IAssociadosService["rejectDocument"]>[3],
      reason: string
    ) => {
      if (!teamId || !selectedLeadId) return;
      await service.rejectDocument(supabaseId, teamId, selectedLeadId, documentType, reason);
      await afterMutation();
    },
    [service, supabaseId, teamId, selectedLeadId, afterMutation]
  );

  const linkDocument = useCallback(
    async (
      documentType: Parameters<IAssociadosService["linkDocument"]>[3]["documentType"],
      attachmentId: string
    ) => {
      if (!teamId || !selectedLeadId) return;
      await service.linkDocument(supabaseId, teamId, selectedLeadId, { documentType, attachmentId });
      await afterMutation();
    },
    [service, supabaseId, teamId, selectedLeadId, afterMutation]
  );

  const uploadPaymentProof = useCallback(
    async (attachmentId: string) => {
      if (!teamId || !selectedLeadId) return;
      await service.uploadPaymentProof(supabaseId, teamId, selectedLeadId, attachmentId);
      await afterMutation();
    },
    [service, supabaseId, teamId, selectedLeadId, afterMutation]
  );

  const refresh = useCallback(async () => {
    lastListSuccessKey.current = null;
    await load();
  }, [load]);

  return {
    isLoading,
    error,
    data,
    filters,
    selectedLeadId,
    drawerOpen,
    detail,
    detailLoading,
    detailError,
    leadAttachments,
    load: refresh,
    setFilters,
    openLead,
    closeDrawer,
    reloadDetail,
    criticize,
    registerSale,
    approveDocument,
    rejectDocument,
    linkDocument,
    uploadPaymentProof,
  };
}
