'use client';

import { createContext, ReactNode, useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Lead, ColumnKey } from "./PipelineTypes";
import { createBoardService } from "@/app/[supabaseId]/board/features/services/BoardService";
import { IBoardService } from "@/app/[supabaseId]/board/features/services/IBoardServices";
import { useParams, useSearchParams } from "next/navigation";
import { ProfileResponseDTO } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import type { CrmFiltersState } from "@/app/[supabaseId]/crm/features/context/CrmTypes";
import {
  EMPTY_TEAM_STATUS_RULES,
  resolveLeadTimeState,
  type TeamStatusRulesResponse,
} from "@/lib/teamStatusRules";

interface IPipelineProviderProps {
  children: ReactNode;
  pipelineService?: IBoardService;
  externalFilters?: CrmFiltersState;
}

interface TaskOwner {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export type PipelineTableColumnKey =
  | "name"
  | "leadCode"
  | "email"
  | "phone"
  | "currentHealthPlan"
  | "currentValue"
  | "status"
  | "ticket"
  | "assignedTo"
  | "closerId"
  | "meetingDate"
  | "createdAt";

export type PipelineTableColumnVisibility = Record<PipelineTableColumnKey, boolean>;

export const DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY: PipelineTableColumnVisibility = {
  name: true,
  leadCode: false,
  email: true,
  phone: true,
  currentHealthPlan: true,
  currentValue: true,
  status: true,
  ticket: true,
  assignedTo: true,
  closerId: true,
  meetingDate: true,
  createdAt: true,
};

export const DEFAULT_PIPELINE_TABLE_COLUMN_ORDER: string[] = [
  "drag",
  "name",
  "leadCode",
  "email",
  "phone",
  "currentHealthPlan",
  "currentValue",
  "status",
  "ticket",
  "assignedTo",
  "closerId",
  "meetingDate",
  "createdAt",
  "actions",
];

interface IPipelineContextState {
  isLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  onlyMeetingsHeld: boolean;
  setOnlyMeetingsHeld: (value: boolean) => void;
  allLeads: Lead[]; // Todos os leads em um array flat
  filtered: Lead[]; // Leads filtrados
  periodStart: string; 
  setPeriodStart: (date: string) => void;
  periodEnd: string;
  setPeriodEnd: (date: string) => void;
  assignedUser: string; 
  setAssignedUser: (user: string) => void;
  taskOwners: TaskOwner[];
  errors: Record<string, string>;
  open: boolean;
  user: ProfileResponseDTO | null;
  userLoading: boolean;
  setOpen: (open: boolean) => void;
  selected: Lead | null;
  setSelected: (lead: Lead | null) => void;
  clearErrors: () => void;
  handleRowClick: (lead: Lead) => void;
  openNewLeadDialog: () => void;
  refreshLeads: () => Promise<void>;
  patchLead: (leadId: string, patch: Partial<Lead>) => void;
  finalizeContract: (leadId: string, data: FinalizeContractData) => Promise<void>;
  statusLabels: Record<ColumnKey, string>;
  tableColumnVisibility: VisibilityState;
  setTableColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;
  tableColumnOrder: string[];
  setTableColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

const COLUMNS: { key: ColumnKey; title: string }[] = [
  { key: "new_opportunity", title: "Nova oportunidade" },
  { key: "scheduled", title: "Agendado" },
  { key: "no_show", title: "No Show" },
  { key: "pricingRequest", title: "Cotação" },
  { key: "future_sale", title: "Venda Futura" },
  { key: "offerNegotiation", title: "Negociação" },
  { key: "pending_documents", title: "Documentos pendentes" },
  { key: "offerSubmission", title: "Proposta" },
  { key: "dps_agreement", title: "DPS | Contrato" },
  { key: "invoicePayment", title: "Boleto" },
  { key: "disqualified", title: "Desqualificado" },
  { key: "opportunityLost", title: "Perdido" },
  { key: "operator_denied", title: "Negado operadora" },
  { key: "contract_finalized", title: "Negócio fechado" },
];

function formatDate(iso: string) {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

export const PipelineContext = createContext<IPipelineContextState | undefined>(undefined);

export const PipelineProvider: React.FC<IPipelineProviderProps> = ({ 
  children, 
  pipelineService,
  externalFilters,
}) => {
  const resolvedPipelineService = useMemo(
    () => pipelineService ?? createBoardService(),
    [pipelineService]
  );
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId, activeRole, activeFunctions, isLoading: teamLoading } = useTeamContext();
  const { user: contextUser, isLoading: userLoading } = useUserContext();
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const searchParams = useSearchParams();
  const sharedLeadCode = searchParams.get("leadCode");
  const lastHandledShareKeyRef = useRef<string | null>(null);
  const selectedRef = useRef<Lead | null>(null);
  const lastLeadsLoadKeyRef = useRef<string | null>(null);
  const leadsLoadInFlightKeyRef = useRef<string | null>(null);
  const leadsLoadInFlightPromiseRef = useRef<Promise<void> | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyMeetingsHeld, setOnlyMeetingsHeld] = useState(false);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [assignedUser, setAssignedUser] = useState<string>("todos");
  const [teamStatusRules, setTeamStatusRules] =
    useState<TeamStatusRulesResponse>(EMPTY_TEAM_STATUS_RULES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [tableColumnVisibility, setTableColumnVisibility] = useState<VisibilityState>(
    DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY
  );
  const [tableColumnOrder, setTableColumnOrder] = useState<string[]>(
    DEFAULT_PIPELINE_TABLE_COLUMN_ORDER
  );
  const user: ProfileResponseDTO | null = contextUser;
  const accessDeniedShownRef = useRef(false);
  const skipPersistColumnVisibilityRef = useRef(false);
  const skipPersistColumnOrderRef = useRef(false);

  const pipelineColumnsStorageKey = useMemo(() => {
    if (!supabaseId) return null;
    return `pipelineTableColumns:v2:${supabaseId}:${activeTeamId || "default"}`;
  }, [supabaseId, activeTeamId]);

  const pipelineColumnOrderStorageKey = useMemo(() => {
    if (!supabaseId) return null;
    return `pipelineTableColumnOrder:v2:${supabaseId}:${activeTeamId || "default"}`;
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    skipPersistColumnVisibilityRef.current = true;
    if (!pipelineColumnsStorageKey || typeof window === "undefined") {
      setTableColumnVisibility(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY);
      return;
    }

    try {
      const raw = window.localStorage.getItem(pipelineColumnsStorageKey);
      if (!raw) {
        setTableColumnVisibility(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY);
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") {
        setTableColumnVisibility(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY);
        return;
      }

      const nextVisibility: PipelineTableColumnVisibility = {
        ...DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY,
      };

      (Object.keys(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY) as PipelineTableColumnKey[]).forEach((key) => {
        const value = parsed[key];
        if (typeof value === "boolean") {
          nextVisibility[key] = value;
        }
      });

      setTableColumnVisibility(nextVisibility);
    } catch (error) {
      console.error("Erro ao carregar configuracoes da tabela pipeline:", error);
      setTableColumnVisibility(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY);
    }
  }, [pipelineColumnsStorageKey]);

  useEffect(() => {
    if (!pipelineColumnsStorageKey || typeof window === "undefined") {
      return;
    }
    if (skipPersistColumnVisibilityRef.current) {
      skipPersistColumnVisibilityRef.current = false;
      return;
    }

    try {
      window.localStorage.setItem(
        pipelineColumnsStorageKey,
        JSON.stringify(tableColumnVisibility)
      );
    } catch (error) {
      console.error("Erro ao salvar configuracoes da tabela pipeline:", error);
    }
  }, [pipelineColumnsStorageKey, tableColumnVisibility]);

  useEffect(() => {
    skipPersistColumnOrderRef.current = true;
    if (!pipelineColumnOrderStorageKey || typeof window === "undefined") {
      setTableColumnOrder(DEFAULT_PIPELINE_TABLE_COLUMN_ORDER);
      return;
    }

    try {
      const raw = window.localStorage.getItem(pipelineColumnOrderStorageKey);
      if (!raw) {
        setTableColumnOrder(DEFAULT_PIPELINE_TABLE_COLUMN_ORDER);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setTableColumnOrder(DEFAULT_PIPELINE_TABLE_COLUMN_ORDER);
        return;
      }

      const savedOrder = parsed.filter((value): value is string => typeof value === "string");
      const allowed = new Set(DEFAULT_PIPELINE_TABLE_COLUMN_ORDER);
      const validSaved = savedOrder.filter((id) => allowed.has(id));
      const missing = DEFAULT_PIPELINE_TABLE_COLUMN_ORDER.filter((id) => !validSaved.includes(id));
      const normalizedOrder = [...validSaved, ...missing];

      setTableColumnOrder(normalizedOrder);
    } catch (error) {
      console.error("Erro ao carregar ordem das colunas da tabela pipeline:", error);
      setTableColumnOrder(DEFAULT_PIPELINE_TABLE_COLUMN_ORDER);
    }
  }, [pipelineColumnOrderStorageKey]);

  useEffect(() => {
    if (!pipelineColumnOrderStorageKey || typeof window === "undefined") {
      return;
    }
    if (skipPersistColumnOrderRef.current) {
      skipPersistColumnOrderRef.current = false;
      return;
    }

    try {
      window.localStorage.setItem(
        pipelineColumnOrderStorageKey,
        JSON.stringify(tableColumnOrder)
      );
    } catch (error) {
      console.error("Erro ao salvar ordem das colunas da tabela pipeline:", error);
    }
  }, [pipelineColumnOrderStorageKey, tableColumnOrder]);

  const loadTeamStatusRules = useCallback(async () => {
    if (!supabaseId || !activeTeamId) {
      setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
      return;
    }
    try {
      const response = await fetch(`/api/v1/teams/${activeTeamId}/status-rules`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid || !result?.result) {
        setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
        return;
      }
      setTeamStatusRules({
        ...EMPTY_TEAM_STATUS_RULES,
        ...result.result,
      });
    } catch (error) {
      console.error("[PipelineContext] Erro ao carregar regras de status:", error);
      setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
    }
  }, [activeTeamId, supabaseId]);

  useEffect(() => {
    void loadTeamStatusRules();
  }, [loadTeamStatusRules]);

  // Mapeamento de status para labels legíveis
  const statusLabels: Record<ColumnKey, string> = useMemo(() => {
    const labels: Record<ColumnKey, string> = {} as Record<ColumnKey, string>;
    COLUMNS.forEach(({ key, title }) => {
      labels[key] = title;
    });
    return labels;
  }, []);

  // Função para carregar leads da API
  const loadLeads = useCallback(async (options?: { force?: boolean }) => {
    const roleToSend = activeRole || "manager";
    const loadKey = `${supabaseId}:${activeTeamId ?? ""}:${roleToSend}:${(activeFunctions ?? []).slice().sort().join("|")}`;

    if (
      !options?.force &&
      leadsLoadInFlightKeyRef.current === loadKey &&
      leadsLoadInFlightPromiseRef.current
    ) {
      return leadsLoadInFlightPromiseRef.current;
    }

    if (!options?.force && lastLeadsLoadKeyRef.current === loadKey) {
      return;
    }

    const requestPromise = (async () => {
      try {
        setIsLoading(true);
        setErrors({});
        
        if (!supabaseId) {
          setErrors({ api: 'ID do usuário não encontrado' });
          setIsLoading(false);
          return;
        }

        if (!activeTeamId) {
          setErrors({ api: "Selecione um time para visualizar os leads." });
          setIsLoading(false);
          return;
        }
        if (activeRole === "operator" && !activeFunctions?.includes("SDR")) {
          setAllLeads([]);
          setErrors({ api: "Acesso negado: função SDR necessária para visualizar leads." });
          if (!accessDeniedShownRef.current) {
            toast.info("Acesso negado: função SDR necessária para visualizar leads.");
            accessDeniedShownRef.current = true;
          }
          setIsLoading(false);
          return;
        }
        
        const result = await resolvedPipelineService.fetchLeads(supabaseId, roleToSend, activeTeamId);

        if (result.isValid && result.result) {
          console.info('[PipelineContext] Leads fetched from API:', result.result.length, 'leads');
          lastLeadsLoadKeyRef.current = loadKey;
          
          const leadsWithLeadTimeState = result.result.map((lead: Lead) => {
            const state = resolveLeadTimeState(
              lead.status,
              lead.statusEnteredAt || lead.updatedAt || lead.createdAt,
              teamStatusRules.leadTimeRules
            );
            return {
              ...lead,
              statusEnteredAt: lead.statusEnteredAt || lead.updatedAt || lead.createdAt,
              leadTimeDueAt: state.dueAt,
              isLeadTimeBreached: state.isBreached,
            };
          });

          // Armazenar todos os leads em um array flat
          setAllLeads(leadsWithLeadTimeState);

          // Se há um lead selecionado, atualizar com os novos dados
          const currentSelected = selectedRef.current;
          if (currentSelected && currentSelected.id) {
            const updatedLead = leadsWithLeadTimeState.find((l: Lead) => l.id === currentSelected.id);
            if (updatedLead) {
              const hasChanges = 
                updatedLead.meetingDate !== currentSelected.meetingDate ||
                updatedLead.meetingNotes !== currentSelected.meetingNotes ||
                updatedLead.meetingLink !== currentSelected.meetingLink ||
                updatedLead.status !== currentSelected.status ||
                updatedLead.name !== currentSelected.name ||
                updatedLead.email !== currentSelected.email ||
                updatedLead.phone !== currentSelected.phone;

              if (hasChanges) {
                console.info('[PipelineContext] ✅ Updating selected lead with fresh data');
                
                // Notificar usuário sobre mudanças específicas
                if (updatedLead.meetingDate !== currentSelected.meetingDate && updatedLead.meetingDate) {
                  const meetingDateFormatted = new Date(updatedLead.meetingDate).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  toast.info(`📅 Data de reunião atualizada: ${meetingDateFormatted}`, {
                    duration: 3000,
                  });
                }
                
                setSelected(updatedLead);
              }
            }
          }
        } else {
          console.error('Erro ao carregar leads:', result.errorMessages);
          setErrors({ api: result.errorMessages?.join(', ') || 'Erro desconhecido' });
        }
      } catch (error) {
        console.error('Erro ao carregar leads:', error);
        setErrors({ api: 'Erro ao carregar dados' });
      } finally {
        if (leadsLoadInFlightKeyRef.current === loadKey) {
          leadsLoadInFlightKeyRef.current = null;
          leadsLoadInFlightPromiseRef.current = null;
        }
        setIsLoading(false);
      }
    })();

    leadsLoadInFlightKeyRef.current = loadKey;
    leadsLoadInFlightPromiseRef.current = requestPromise;

    return requestPromise;
  }, [activeFunctions, activeRole, activeTeamId, resolvedPipelineService, supabaseId, teamStatusRules.leadTimeRules]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!teamLoading) {
      void loadLeads();
    }
  }, [teamLoading, loadLeads]);

  useEffect(() => {
    if (!sharedLeadCode) {
      lastHandledShareKeyRef.current = null;
      return;
    }
    if (isLoading) return;

    const sharedActivityId = searchParams.get("activityId");
    const shareKey = `${sharedLeadCode}:${sharedActivityId ?? ""}`;
    if (lastHandledShareKeyRef.current === shareKey) return;

    const targetLead = allLeads.find((lead) => lead.leadCode === sharedLeadCode);
    if (targetLead) {
      setSelected(targetLead);
      setOpen(true);
    } else {
      toast.info("Lead não encontrado ou sem permissão no seu time.");
    }
    lastHandledShareKeyRef.current = shareKey;
  }, [allLeads, sharedLeadCode, isLoading, searchParams]);

  // Função para finalizar contrato
  const finalizeContract = async (leadId: string, contractData: FinalizeContractData) => {
    try {
      const response = await fetch(`/api/v1/leads/${leadId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': activeTeamId || ''
        },
        body: JSON.stringify(contractData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errorMessages?.[0] || 'Erro ao finalizar contrato');
      }

      await loadLeads({ force: true });
    } catch (error) {
      console.error('Erro ao finalizar contrato:', error);
      throw error;
    }
  };

  const clearErrors = () => {
    setErrors({});
  };

  const handleRowClick = (lead: Lead) => {
    setSelected(lead);
    setOpen(true);
  };

  const openNewLeadDialog = () => {
    setSelected(null);
    setOpen(true);
  };

  const patchLead = (leadId: string, patch: Partial<Lead>) => {
    setAllLeads((prev) => prev.map((l) => (l.id === leadId ? ({ ...l, ...patch } as Lead) : l)));
    setSelected((prev) => (prev?.id === leadId ? ({ ...prev, ...patch } as Lead) : prev));
  };

  // Filtrar leads
  const filtered = useMemo(() => {
    const activeQuery = externalFilters !== undefined ? externalFilters.query : query;
    const activeStatuses = externalFilters?.statusFilter ?? [];
    const activeAssignedUsers =
      externalFilters !== undefined
        ? externalFilters.assignedUsers
        : assignedUser !== "todos"
        ? [assignedUser]
        : [];
    const activeClosers = externalFilters?.closerFilter ?? [];
    const activeStart = externalFilters !== undefined ? externalFilters.periodStart : periodStart;
    const activeEnd = externalFilters !== undefined ? externalFilters.periodEnd : periodEnd;
    const activeMeetingsHeld =
      externalFilters !== undefined ? externalFilters.onlyMeetingsHeld : onlyMeetingsHeld;

    const q = activeQuery.trim().toLowerCase();
    
    return allLeads.filter((lead) => {
      // Filtro por query (nome ou data)
      const matchesQuery = !q || 
        lead.name.toLowerCase().includes(q) || 
        lead.leadCode.toLowerCase().includes(q) ||
        formatDate(lead.createdAt).includes(q);
      
      // Filtro por status
      const matchesStatus =
        activeStatuses.length === 0 || activeStatuses.includes(lead.status as string);
      
      // Filtro por responsável (suporta múltiplos)
      const matchesResponsible =
        activeAssignedUsers.length === 0 || activeAssignedUsers.includes(lead.assignedTo as string);

      // Filtro por closer
      const matchesCloser =
        activeClosers.length === 0 || activeClosers.includes((lead.closerId ?? "") as string);

      // Filtro por período
      const d = lead.createdAt;
      const afterStart = !activeStart || d >= activeStart;
      const beforeEnd = !activeEnd || d <= activeEnd;
      const matchesPeriod = afterStart && beforeEnd;

      const matchesMeetingsHeld = !activeMeetingsHeld || lead.meetingHeald === "yes";

      return matchesQuery && matchesStatus && matchesResponsible && matchesCloser && matchesMeetingsHeld && matchesPeriod;
    });
  }, [allLeads, externalFilters, query, assignedUser, onlyMeetingsHeld, periodStart, periodEnd]);

  // Extrair lista de responsáveis únicos
  const taskOwners = useMemo(() => {
    return sdrMembers
      .map((sdr) => ({
        id: sdr.id,
        name: sdr.name || sdr.email,
        avatarUrl: sdr.avatarImageUrl || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sdrMembers]);

  const value: IPipelineContextState = {
    isLoading,
    query,
    setQuery,
    onlyMeetingsHeld,
    setOnlyMeetingsHeld,
    allLeads,
    filtered,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    assignedUser,
    setAssignedUser,
    taskOwners,
    errors,
    open,
    user,
    userLoading,
    setOpen,
    selected,
    setSelected,
    clearErrors,
    handleRowClick,
    openNewLeadDialog,
    refreshLeads: () => loadLeads({ force: true }),
    patchLead,
    finalizeContract,
    statusLabels,
    tableColumnVisibility,
    setTableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
  };
  
  return (
    <PipelineContext.Provider value={value}>
      {children}
    </PipelineContext.Provider>
  );
}

// Exportar constantes úteis
export { COLUMNS, formatDate };
