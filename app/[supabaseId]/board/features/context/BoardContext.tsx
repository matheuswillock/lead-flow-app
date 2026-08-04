import { createContext, ReactNode, useMemo, useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import {
  isAllowedStatusTransitionFromProductGates,
} from "@/lib/leadStatusTransitionRules";
import {
  fetchProductTransitionGates,
  type ProductLeadStatusTransitionGate,
} from "@/lib/services/leadStatusTransitionGatesClient";
import { IBoardService } from "../services/IBoardServices";
import { Lead, ColumnKey } from "./BoardTypes";
import { createBoardService } from "../services/BoardService";
import { useParams, useSearchParams } from "next/navigation";
import { ProfileResponseDTO } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { FinalizeContractData } from "../container/FinalizeContractDialog";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import { useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import type {
  MissingSalesField,
  SalesInfoInitialValues,
  SalesInfoPayload,
} from "@/app/[supabaseId]/components/SalesInfoRequirementDialog";
import type { CloserRequirementPayload } from "@/app/[supabaseId]/components/CloserRequirementDialog";
import type { CrmFiltersState } from "@/app/[supabaseId]/crm/features/context/CrmTypes";
import type {
  CustomFieldFilterState,
  CustomFieldSortState,
} from "@/app/[supabaseId]/components/leads-filters/customFieldFilterTypes";
import type { CustomFieldFilterInput } from "@/lib/leadCustomFields/customFieldQuery";
import {
  createLeadTimeRulesVersion,
  EMPTY_TEAM_STATUS_RULES,
  resolveLeadTimeState,
  type TeamStatusRulesResponse,
} from "@/lib/teamStatusRules";
import { formatIntimezone, formatLocalDateValue } from "@/lib/dates"
import { FIELD_CATALOG, apiKeyToFieldKey, mapLeadInfoPayloadForUpdate, type LeadTransitionFieldApiKey } from "@/lib/leadStatusTransitionFields";
import {
  leadStatusTransitionClient,
  type LeadStatusTransitionTrigger,
} from "@/lib/services/leadStatusTransitionClient";
import type {
  LeadInfoInitialValues,
  LeadInfoPayload,
} from "@/app/[supabaseId]/components/LeadInfoRequirementDialog";
import { API_CLIENT_BASE } from "@/lib/route-map";

interface IBoardProviderProps {
  children: ReactNode;
  boardService?: IBoardService;
  externalFilters?: CrmFiltersState;
  calendarWindow?: { start: Date; end: Date } | null;
}

export type LeadCardField = "name" | "entryDate" | "meetingInfo" | "notes" | "id";
export type LeadCardDisplaySettings = Record<LeadCardField, boolean>;

export const DEFAULT_LEAD_CARD_DISPLAY: LeadCardDisplaySettings = {
  name: true,
  entryDate: true,
  meetingInfo: true,
  notes: false,
  id: true,
};

interface TaskOwner {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

type PendingScheduledDrop = {
  leadId: string;
  from: ColumnKey;
};

type PendingStatusTriggerDrop = {
  leadId: string;
  from: ColumnKey;
  to: ColumnKey;
  confirmationRuleId?: string | null;
  confirmationMessage?: string | null;
};

type PendingFinalizeDrop = {
  leadId: string;
  from: ColumnKey;
};

type PendingMeetingHealdGateDrop = {
  leadId: string;
  from: ColumnKey;
  to: ColumnKey;
  canConfirmMeetingHeald: boolean;
  trigger?: LeadStatusTransitionTrigger;
};

type PendingSalesInfoGateDrop = {
  leadId: string;
  from: ColumnKey;
  to: ColumnKey;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: MissingSalesField[];
  currentSalesInfo: SalesInfoInitialValues;
};

type PendingCloserGateDrop = {
  leadId: string;
  from: ColumnKey;
  to: ColumnKey;
  trigger?: LeadStatusTransitionTrigger;
  currentCloserId: string | null;
};

type PendingLeadInfoGateDrop = {
  leadId: string;
  from: ColumnKey;
  to: ColumnKey;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: LeadTransitionFieldApiKey[];
  currentLeadInfo: LeadInfoInitialValues;
};

interface IBoardContextState {
  isLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  onlyMeetingsHeld: boolean;
  setOnlyMeetingsHeld: (value: boolean) => void;
  onlyTransfer: boolean;
  setOnlyTransfer: (value: boolean) => void;
  leadCardDisplay: LeadCardDisplaySettings;
  setLeadCardDisplay: Dispatch<SetStateAction<LeadCardDisplaySettings>>;
  data: Record<ColumnKey, Lead[]>;
  filtered: Record<ColumnKey, Lead[]>;
  periodStart: string; 
  setPeriodStart: (date: string) => void;
  periodEnd: string;
  setPeriodEnd: (date: string) => void;
  assignedUsers: string[]; 
  setAssignedUsers: (users: string[]) => void;
  statusFilter: ColumnKey[];
  setStatusFilter: (statuses: ColumnKey[]) => void;
  closerFilter: string[];
  setCloserFilter: (closers: string[]) => void;
  customFieldFilters: CustomFieldFilterState[];
  setCustomFieldFilters: (filters: CustomFieldFilterState[]) => void;
  customFieldSort: CustomFieldSortState | null;
  setCustomFieldSort: (sort: CustomFieldSortState | null) => void;
  taskOwners: TaskOwner[];
  statusLabels: Record<ColumnKey, string>;
  errors: Record<string, string>;
  open: boolean;
  user: ProfileResponseDTO | null;
  userLoading: boolean;
  setOpen: (open: boolean) => void;
  selected: Lead | null;
  clearErrors: () => void;
  handleCardClick: (lead: Lead) => void;
  handleCardMouseDown: () => void;
  handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
  openNewLeadDialog: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, to: ColumnKey) => void;
  onDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
  refreshLeads: () => Promise<void>;
  patchLead: (leadId: string, patch: Partial<Lead>) => void;
  pendingScheduledDrop: PendingScheduledDrop | null;
  clearPendingScheduledDrop: () => void;
  applyScheduledTransition: (from: ColumnKey, payload: Partial<Lead> & Pick<Lead, "id" | "status">) => void;
  pendingStatusTriggerDrop: PendingStatusTriggerDrop | null;
  clearPendingStatusTriggerDrop: () => void;
  applyPendingStatusTriggerTransition: (trigger: {
    followUpAt?: string;
    followUpNotes?: string;
    reason?: string;
    reasonDetails?: string;
    confirmRuleId?: string;
  }) => Promise<boolean>;
  pendingMeetingHealdGateDrop: PendingMeetingHealdGateDrop | null;
  clearPendingMeetingHealdGateDrop: () => void;
  applyPendingMeetingHealdGateTransition: () => Promise<boolean>;
  pendingSalesInfoGateDrop: PendingSalesInfoGateDrop | null;
  clearPendingSalesInfoGateDrop: () => void;
  applyPendingSalesInfoGateTransition: (payload: SalesInfoPayload) => Promise<boolean>;
  pendingCloserGateDrop: PendingCloserGateDrop | null;
  clearPendingCloserGateDrop: () => void;
  applyPendingCloserGateTransition: (payload: CloserRequirementPayload) => Promise<boolean>;
  pendingLeadInfoGateDrop: PendingLeadInfoGateDrop | null;
  clearPendingLeadInfoGateDrop: () => void;
  applyPendingLeadInfoGateTransition: (payload: LeadInfoPayload) => Promise<boolean>;
  pendingFinalizeDrop: PendingFinalizeDrop | null;
  clearPendingFinalizeDrop: () => void;
  finalizeContract: (leadId: string, data: FinalizeContractData) => Promise<void>;
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

function formatDate(iso: string, tz: string) {
  try {
    return formatIntimezone(new Date(iso), "dd/MM/yyyy", tz);
  } catch {
    return iso;
  }
}

function formatDateKey(iso: string, tz: string) {
  try {
    return formatLocalDateValue(new Date(iso), tz);
  } catch {
    return "";
  }
}

function formatMissingLeadFields(missingFields: LeadTransitionFieldApiKey[]) {
  const labels = missingFields
    .map((field) => {
      try {
        return FIELD_CATALOG[apiKeyToFieldKey(field)].label;
      } catch {
        return null;
      }
    })
    .filter((label): label is string => !!label);

  if (!labels.length) return null;
  return labels.join(", ");
}

export const BoardContext = createContext<IBoardContextState | undefined>(undefined);

export const BoardProvider: React.FC<IBoardProviderProps> = ({ 
  children, 
  boardService,
  externalFilters,
  calendarWindow = null,
}) => {
  const resolvedBoardService = useMemo(
    () => boardService ?? createBoardService(),
    [boardService]
  );
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId, activeRole, activeFunctions, isLoading: teamLoading } = useTeamContext();
  const { user: contextUser, isLoading: userLoading } = useUserContext();
  const { tz } = useTimezone();
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const searchParams = useSearchParams();
  const sharedLeadCode = searchParams.get("leadCode");
  const lastHandledShareKeyRef = useRef<string | null>(null);
  const lastLeadsLoadKeyRef = useRef<string | null>(null);
  const leadsLoadInFlightKeyRef = useRef<string | null>(null);
  const leadsLoadInFlightPromiseRef = useRef<Promise<void> | null>(null);
  const statusRulesInFlightKeyRef = useRef<string | null>(null);
  const lastStatusRulesSettledKeyRef = useRef<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyMeetingsHeld, setOnlyMeetingsHeld] = useState(false);
  const [onlyTransfer, setOnlyTransfer] = useState(false);
  const [onlyDraft, setOnlyDraft] = useState(false);
  const [leadCardDisplay, setLeadCardDisplay] = useState<LeadCardDisplaySettings>(
    DEFAULT_LEAD_CARD_DISPLAY
  );
  const [data, setData] = useState<Record<ColumnKey, Lead[]>>(() => {
    // Inicializa todas as colunas com arrays vazios
    const initialData: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
    COLUMNS.forEach(({ key }) => {
      initialData[key] = [];
    });
    return initialData;
  });

  // TODO: Implementar o carregamento de todos os leads operators do manager
  // TODO: Implementar rastreio de quantidade de leads foram agendados, convertidos, perdidos, etc.

  const [periodStart, setPeriodStart] = useState<string>(""); // yyyy-mm-dd
  const [periodEnd, setPeriodEnd] = useState<string>(""); // yyyy-mm-dd
  const [scheduledPeriodStart, setScheduledPeriodStart] = useState<string>(""); // yyyy-mm-dd
  const [scheduledPeriodEnd, setScheduledPeriodEnd] = useState<string>(""); // yyyy-mm-dd
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ColumnKey[]>([]);
  const [closerFilter, setCloserFilter] = useState<string[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterState[]>([]);
  const [customFieldSort, setCustomFieldSort] = useState<CustomFieldSortState | null>(null);
  const [teamStatusRules, setTeamStatusRules] =
    useState<TeamStatusRulesResponse>(EMPTY_TEAM_STATUS_RULES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingScheduledDrop, setPendingScheduledDrop] = useState<PendingScheduledDrop | null>(null);
  const [pendingStatusTriggerDrop, setPendingStatusTriggerDrop] = useState<PendingStatusTriggerDrop | null>(null);
  const [pendingFinalizeDrop, setPendingFinalizeDrop] = useState<PendingFinalizeDrop | null>(null);
  const [pendingMeetingHealdGateDrop, setPendingMeetingHealdGateDrop] =
    useState<PendingMeetingHealdGateDrop | null>(null);
  const [pendingSalesInfoGateDrop, setPendingSalesInfoGateDrop] =
    useState<PendingSalesInfoGateDrop | null>(null);
  const [pendingCloserGateDrop, setPendingCloserGateDrop] =
    useState<PendingCloserGateDrop | null>(null);
  const [pendingLeadInfoGateDrop, setPendingLeadInfoGateDrop] =
    useState<PendingLeadInfoGateDrop | null>(null);
  const [transitionGates, setTransitionGates] = useState<ProductLeadStatusTransitionGate[]>([]);

  // Sync external CRM filters into board filter state whenever they change.
  // Using useEffect (not lazy initializer) is safe because data loads asynchronously;
  // filters are applied before any leads appear in the UI.
  useEffect(() => {
    if (!externalFilters) return;
    setQuery(externalFilters.query);
    setStatusFilter(externalFilters.statusFilter as ColumnKey[]);
    setAssignedUsers(externalFilters.assignedUsers);
    setCloserFilter(externalFilters.closerFilter);
    setPeriodStart(externalFilters.periodStart);
    setPeriodEnd(externalFilters.periodEnd);
    setScheduledPeriodStart(externalFilters.scheduledPeriodStart);
    setScheduledPeriodEnd(externalFilters.scheduledPeriodEnd);
    setOnlyMeetingsHeld(externalFilters.onlyMeetingsHeld);
    setOnlyTransfer(externalFilters.onlyTransfer);
    setOnlyDraft(externalFilters.onlyDraft);
    setCustomFieldFilters(externalFilters.customFieldFilters);
    setCustomFieldSort(externalFilters.customFieldSort);
  }, [externalFilters]);

  useEffect(() => {
    if (!supabaseId) return;
    void fetchProductTransitionGates({ supabaseId, teamId: activeTeamId }).then(setTransitionGates);
  }, [supabaseId, activeTeamId]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const selectedRef = useRef<Lead | null>(null);
  const dataRef = useRef<Record<ColumnKey, Lead[]>>({} as Record<ColumnKey, Lead[]>);
  const teamStatusRulesRef = useRef<TeamStatusRulesResponse>(EMPTY_TEAM_STATUS_RULES);
  const dragStartedRef = useRef(false);
  const user = contextUser as ProfileResponseDTO | null;
  const userRef = useRef<ProfileResponseDTO | null>(null);
  const accessDeniedShownRef = useRef(false);
  const skipPersistLeadCardDisplayRef = useRef(false);

  const leadCardDisplayStorageKey = useMemo(() => {
    if (!supabaseId) return null;
    return `leadCardDisplay:${supabaseId}:${activeTeamId || "default"}`;
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    skipPersistLeadCardDisplayRef.current = true;
    if (!leadCardDisplayStorageKey || typeof window === "undefined") {
      setLeadCardDisplay(DEFAULT_LEAD_CARD_DISPLAY);
      return;
    }
    try {
      const raw = window.localStorage.getItem(leadCardDisplayStorageKey);
      if (!raw) {
        setLeadCardDisplay(DEFAULT_LEAD_CARD_DISPLAY);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") {
        setLeadCardDisplay(DEFAULT_LEAD_CARD_DISPLAY);
        return;
      }
      const nextDisplay: LeadCardDisplaySettings = { ...DEFAULT_LEAD_CARD_DISPLAY };
      (Object.keys(DEFAULT_LEAD_CARD_DISPLAY) as LeadCardField[]).forEach((key) => {
        const value = parsed[key];
        if (typeof value === "boolean") {
          nextDisplay[key] = value;
        }
      });
      setLeadCardDisplay(nextDisplay);
    } catch (error) {
      console.error("Erro ao carregar configurações do card:", error);
      setLeadCardDisplay(DEFAULT_LEAD_CARD_DISPLAY);
    }
  }, [leadCardDisplayStorageKey]);

  useEffect(() => {
    if (!leadCardDisplayStorageKey || typeof window === "undefined") {
      return;
    }
    if (skipPersistLeadCardDisplayRef.current) {
      skipPersistLeadCardDisplayRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        leadCardDisplayStorageKey,
        JSON.stringify(leadCardDisplay)
      );
    } catch (error) {
      console.error("Erro ao salvar configurações do card:", error);
    }
  }, [leadCardDisplayStorageKey, leadCardDisplay]);

  const loadTeamStatusRules = useCallback(async (options?: { force?: boolean }) => {
    if (!supabaseId || !activeTeamId) {
      setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
      lastStatusRulesSettledKeyRef.current = null;
      statusRulesInFlightKeyRef.current = null;
      return;
    }

    const requestKey = `${supabaseId}:${activeTeamId}`;
    if (
      !options?.force &&
      (statusRulesInFlightKeyRef.current === requestKey ||
        lastStatusRulesSettledKeyRef.current === requestKey)
    ) {
      return;
    }

    statusRulesInFlightKeyRef.current = requestKey;
    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/${activeTeamId}/status-rules`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid || !result?.result) {
        setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
        lastStatusRulesSettledKeyRef.current = requestKey;
        return;
      }
      setTeamStatusRules({
        ...EMPTY_TEAM_STATUS_RULES,
        ...result.result,
      });
      lastStatusRulesSettledKeyRef.current = requestKey;
    } catch (error) {
      console.error("[BoardContext] Erro ao carregar regras de status:", error);
      setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
      lastStatusRulesSettledKeyRef.current = requestKey;
    } finally {
      if (statusRulesInFlightKeyRef.current === requestKey) {
        statusRulesInFlightKeyRef.current = null;
      }
    }
  }, [activeTeamId, supabaseId]);

  useEffect(() => {
    void loadTeamStatusRules();
  }, [loadTeamStatusRules]);

  // Função para carregar leads da API
  const loadLeads = useCallback(async (options?: { force?: boolean }) => {
    const roleToSend = activeRole || "manager";
    const leadTimeRulesVersion = createLeadTimeRulesVersion(teamStatusRules.leadTimeRules);
    const calendarWindowKey = calendarWindow
      ? `${calendarWindow.start.toISOString()}:${calendarWindow.end.toISOString()}`
      : "";
    const customFieldFiltersKey = JSON.stringify(
      customFieldFilters.map(({ definitionId, operator, value }) => ({ definitionId, operator, value }))
    );
    const customFieldSortKey = customFieldSort ? `${customFieldSort.definitionId}:${customFieldSort.direction}` : "";
    const loadKey = `${supabaseId}:${activeTeamId ?? ""}:${roleToSend}:${(activeFunctions ?? []).slice().sort().join("|")}:${leadTimeRulesVersion}:${calendarWindowKey}:${customFieldFiltersKey}:${customFieldSortKey}`;

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
        setErrors({}); // Limpa erros anteriores
        
        if (!supabaseId) {
          setErrors({ api: 'ID do usuário não encontrado' });
          lastLeadsLoadKeyRef.current = loadKey;
          setIsLoading(false);
          return;
        }

        if (!activeTeamId) {
          setErrors({ api: "Selecione um time para visualizar os leads." });
          lastLeadsLoadKeyRef.current = loadKey;
          setIsLoading(false);
          return;
        }

        const currentUser = userRef.current;
        if (!currentUser) {
          setIsLoading(false);
          return;
        }
        if (activeRole === "operator" && !activeFunctions?.includes("SDR")) {
          setData(() => {
            const empty: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
            COLUMNS.forEach(({ key }) => {
              empty[key] = [];
            });
            return empty;
          });
          setErrors({ api: "Acesso negado: função SDR necessária para visualizar leads." });
          if (!accessDeniedShownRef.current) {
            toast.info("Acesso negado: função SDR necessária para visualizar leads.");
            accessDeniedShownRef.current = true;
          }
          lastLeadsLoadKeyRef.current = loadKey;
          setIsLoading(false);
          return;
        }
        
        const result = await resolvedBoardService.fetchLeads(supabaseId, roleToSend, activeTeamId, {
          ...(calendarWindow && {
            calendarWindowStart: calendarWindow.start,
            calendarWindowEnd: calendarWindow.end,
          }),
          ...(customFieldFilters.length > 0 && {
            customFieldFilters: customFieldFilters.map(
              ({ definitionId, operator, value }): CustomFieldFilterInput => ({ definitionId, operator, value })
            ),
          }),
          ...(customFieldSort && { customFieldSort }),
        });

        // Uma chamada mais recente pode ter substituído esta antes da resposta
        // chegar (ex.: usuário adiciona/remove filtros rapidamente) — descarta
        // a resposta obsoleta em vez de sobrescrever o estado com dados velhos.
        if (leadsLoadInFlightKeyRef.current !== loadKey) {
          return;
        }

        if (result.isValid && result.result) {
          const leadsPayload = result.result as { leads: Lead[]; total: number } | Lead[];
          const fetchedLeads: Lead[] = Array.isArray(leadsPayload) ? leadsPayload : leadsPayload.leads;
          console.info('[BoardContext] Leads fetched from API:', fetchedLeads.length, 'leads');
          lastLeadsLoadKeyRef.current = loadKey;

          // Log dos meetingDates para debug
          const leadsWithMeetingDate = fetchedLeads.filter((l: Lead) => l.meetingDate);
          if (leadsWithMeetingDate.length > 0) {
            console.info('[BoardContext] Leads with meetingDate:', leadsWithMeetingDate.map((l: Lead) => ({
              id: l.id,
              name: l.name,
              meetingDate: l.meetingDate,
              status: l.status
            })));
          }

          const leadsWithLeadTimeState = fetchedLeads.map((lead: Lead) => {
            if (!lead.status) {
              return {
                ...lead,
                statusEnteredAt: lead.statusEnteredAt || lead.updatedAt || lead.createdAt,
                leadTimeDueAt: null,
                isLeadTimeBreached: false,
              };
            }

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

          // Organizar leads por status (coluna)
          const leadsGroupedByStatus: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
          
          // Inicializa todas as colunas com arrays vazios
          COLUMNS.forEach(({ key }) => {
            leadsGroupedByStatus[key] = [];
          });
          
          // Distribui os leads nas colunas corretas baseado no status
          leadsWithLeadTimeState.forEach((lead: Lead) => {
            if (!lead.status) return;
            if (leadsGroupedByStatus[lead.status]) {
              leadsGroupedByStatus[lead.status].push(lead);
            }
          });
          
          setData(leadsGroupedByStatus);

          // Se há um lead selecionado, atualizar com os novos dados
          const currentSelected = selectedRef.current;
          if (currentSelected && currentSelected.id) {
            console.info('[BoardContext] Checking if selected lead needs update...', {
              selectedId: currentSelected.id,
              currentMeetingDate: currentSelected.meetingDate
            });

            const updatedLead = leadsWithLeadTimeState.find((l: Lead) => l.id === currentSelected.id);
            if (updatedLead) {
              console.info('[BoardContext] Found updated lead in API response:', {
                newMeetingDate: updatedLead.meetingDate,
                newStatus: updatedLead.status
              });

              const hasChanges = 
                updatedLead.meetingDate !== currentSelected.meetingDate ||
                updatedLead.meetingNotes !== currentSelected.meetingNotes ||
                updatedLead.meetingLink !== currentSelected.meetingLink ||
                updatedLead.status !== currentSelected.status ||
                updatedLead.name !== currentSelected.name ||
                updatedLead.email !== currentSelected.email ||
                updatedLead.phone !== currentSelected.phone;

              console.info('[BoardContext] Has changes?', hasChanges, {
                meetingDateChanged: updatedLead.meetingDate !== currentSelected.meetingDate,
                statusChanged: updatedLead.status !== currentSelected.status
              });

              if (hasChanges) {
                console.info('[BoardContext] ✅ Updating selected lead with fresh data');
                
                // 🎉 Notificar usuário sobre mudanças específicas
                if (updatedLead.meetingDate !== currentSelected.meetingDate && updatedLead.meetingDate) {
                  const meetingDateFormatted = formatIntimezone(
                    new Date(updatedLead.meetingDate),
                    "dd 'de' MMMM 'de' yyyy HH:mm",
                    tz,
                  )
                  toast.info(`📅 Data de reunião atualizada: ${meetingDateFormatted}`, {
                    duration: 3000,
                  });
                }
                
                setSelected(updatedLead);
              } else {
                console.info('[BoardContext] ℹ️ No changes detected, keeping current selected');
              }
            } else {
              console.info('[BoardContext] ⚠️ Selected lead not found in API response');
            }
          }
        } else {
          console.error('Erro ao carregar leads:', result.errorMessages);
          // Assenta a chave mesmo em erro para evitar retry storm em 5xx.
          lastLeadsLoadKeyRef.current = loadKey;
          setErrors({ api: result.errorMessages?.join(', ') || 'Erro desconhecido' });
        }
      } catch (error) {
        console.error('Erro ao carregar leads:', error);
        lastLeadsLoadKeyRef.current = loadKey;
        setErrors({ api: 'Erro ao carregar dados' });
      } finally {
        if (leadsLoadInFlightKeyRef.current === loadKey) {
          leadsLoadInFlightKeyRef.current = null;
          leadsLoadInFlightPromiseRef.current = null;
          setIsLoading(false);
        }
      }
    })();

    leadsLoadInFlightKeyRef.current = loadKey;
    leadsLoadInFlightPromiseRef.current = requestPromise;

    return requestPromise;
  }, [activeFunctions, activeRole, activeTeamId, calendarWindow, customFieldFilters, customFieldSort, resolvedBoardService, supabaseId, teamStatusRules.leadTimeRules]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    teamStatusRulesRef.current = teamStatusRules;
  }, [teamStatusRules]);

  useEffect(() => {
    if (userLoading) return;
    if (teamLoading) return;
    void loadLeads();
  }, [userLoading, teamLoading, loadLeads]);

  useEffect(() => {
    if (!sharedLeadCode) {
      lastHandledShareKeyRef.current = null;
      return;
    }
    if (isLoading) return;

    const sharedActivityId = searchParams.get("activityId");
    const shareKey = `${sharedLeadCode}:${sharedActivityId ?? ""}`;
    if (lastHandledShareKeyRef.current === shareKey) return;

    const allLeads = Object.values(data).flat();
    const targetLead = allLeads.find((lead) => lead.leadCode === sharedLeadCode);
    if (targetLead) {
      setSelected(targetLead);
      setOpen(true);
    } else {
      toast.info("Lead não encontrado ou sem permissão no seu time.");
    }
    lastHandledShareKeyRef.current = shareKey;
  }, [data, sharedLeadCode, isLoading, searchParams]);

  const onDragStart = useCallback((e: React.DragEvent, leadId: string, from: ColumnKey) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ leadId, from }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleCardMouseDown = useCallback(() => {
    dragStartedRef.current = false;
  }, []);

  const handleCardDragStart = useCallback(
    (e: React.DragEvent, leadId: string, from: ColumnKey) => {
      dragStartedRef.current = true;
      onDragStart(e, leadId, from);
    },
    [onDragStart]
  );

  const handleCardClick = useCallback((lead: Lead) => {
    if (dragStartedRef.current) return;
    setSelected(lead);
    setOpen(true);
  }, []);

  const openNewLeadDialog = useCallback(() => {
    setSelected(null);
    setOpen(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
    
  const moveLeadBetweenColumns = useCallback(
    (leadId: string, from: ColumnKey, to: ColumnKey, patch?: Partial<Lead>): boolean => {
      let moved = false;
      let reconciledLead: Lead | null = null;

      setData((prev) => {
        const fromArr = [...(prev[from] || [])];
        const toArr = [...(prev[to] || [])];
        const idx = fromArr.findIndex((l) => l.id === leadId);
        if (idx === -1) return prev;

        const [movedLead] = fromArr.splice(idx, 1);
        const merged = { ...movedLead, ...patch, status: to } as Lead;
        const statusEnteredAt =
          patch?.statusEnteredAt || patch?.updatedAt || new Date().toISOString();
        const leadTimeState = resolveLeadTimeState(
          to,
          statusEnteredAt,
          teamStatusRulesRef.current.leadTimeRules
        );
        reconciledLead = {
          ...merged,
          statusEnteredAt,
          leadTimeDueAt: leadTimeState.dueAt,
          isLeadTimeBreached: leadTimeState.isBreached,
        } as Lead;

        const existingIdx = toArr.findIndex((l) => l.id === leadId);
        if (existingIdx !== -1) {
          toArr.splice(existingIdx, 1);
        }
        toArr.unshift(reconciledLead);

        moved = true;
        return { ...prev, [from]: fromArr, [to]: toArr };
      });

      if (moved && reconciledLead) {
        const next = reconciledLead;
        setSelected((prev) => (prev?.id === leadId ? next : prev));
      }

      return moved;
    },
    []
  );

  const patchLead = useCallback((leadId: string, patch: Partial<Lead>) => {
    let reconciledLead: Lead | null = null;

    setData((prev) => {
      let fromColumn: ColumnKey | null = null;
      let currentLead: Lead | null = null;

      for (const { key } of COLUMNS) {
        const match = (prev[key] || []).find((lead) => lead.id === leadId);
        if (match) {
          fromColumn = key;
          currentLead = match;
          break;
        }
      }

      if (!fromColumn || !currentLead) {
        return prev;
      }

      const requestedStatus = patch.status ?? currentLead.status;
      const toColumn = COLUMNS.some(({ key }) => key === requestedStatus)
        ? (requestedStatus as ColumnKey)
        : fromColumn;
      const merged = { ...currentLead, ...patch, status: toColumn } as Lead;
      const statusEnteredAt =
        patch.statusEnteredAt ||
        (toColumn !== currentLead.status
          ? patch.updatedAt || new Date().toISOString()
          : merged.statusEnteredAt || merged.updatedAt || merged.createdAt);
      const leadTimeState = resolveLeadTimeState(
        toColumn,
        statusEnteredAt,
        teamStatusRulesRef.current.leadTimeRules
      );

      reconciledLead = {
        ...merged,
        statusEnteredAt,
        leadTimeDueAt: leadTimeState.dueAt,
        isLeadTimeBreached: leadTimeState.isBreached,
      } as Lead;

      if (fromColumn === toColumn) {
        return {
          ...prev,
          [fromColumn]: (prev[fromColumn] || []).map((lead) =>
            lead.id === leadId ? reconciledLead! : lead
          ),
        };
      }

      const fromArr = (prev[fromColumn] || []).filter((lead) => lead.id !== leadId);
      const toArr = (prev[toColumn] || []).filter((lead) => lead.id !== leadId);

      return {
        ...prev,
        [fromColumn]: fromArr,
        [toColumn]: [reconciledLead!, ...toArr],
      };
    });

    if (reconciledLead) {
      const next = reconciledLead;
      setSelected((prev) => (prev?.id === leadId ? next : prev));
    }
  }, []);

  const updateLeadStatusInAPI = useCallback(
    async (
      leadId: string,
      newStatus: ColumnKey,
      trigger?: LeadStatusTransitionTrigger,
      pendingDropContext?: { from: ColumnKey; to: ColumnKey }
    ) => {
      const loadingToast = toast.loading('Atualizando status do lead...');

      try {
        const transitionResult = await leadStatusTransitionClient.executeStatusTransition({
          leadId,
          targetStatus: newStatus,
          supabaseId,
          teamId: activeTeamId,
          trigger,
        });
        const { output, transition } = transitionResult;

        if (!transition.allowed) {
          const transitionMessage =
            output.errorMessages?.[0] || "Não foi possível concluir a mudança de status.";
          const fallbackContext =
            pendingDropContext ??
            (pendingStatusTriggerDrop &&
            pendingStatusTriggerDrop.leadId === leadId &&
            pendingStatusTriggerDrop.to === newStatus
              ? { from: pendingStatusTriggerDrop.from, to: pendingStatusTriggerDrop.to }
              : null);

          if (transition.blockerType === "meeting_heald") {
            if (fallbackContext) {
              setPendingMeetingHealdGateDrop({
                leadId,
                from: fallbackContext.from,
                to: fallbackContext.to,
                canConfirmMeetingHeald: !!transition.canConfirmMeetingHeald,
                trigger: trigger ? { ...trigger } : undefined,
              });
            } else {
              setPendingMeetingHealdGateDrop(null);
            }

            toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
            return output;
          }

          if (transition.blockerType === "sales_info") {
            const sourceLead =
              fallbackContext
                ? dataRef.current[fallbackContext.from]?.find((lead) => lead.id === leadId) ?? null
                : null;
            const missingFields = Array.isArray(transition.missingFields)
              ? transition.missingFields
              : [];

            if (fallbackContext) {
              setPendingSalesInfoGateDrop({
                leadId,
                from: fallbackContext.from,
                to: fallbackContext.to,
                trigger: trigger ? { ...trigger } : undefined,
                missingFields,
                currentSalesInfo: {
                  ticket:
                    typeof transition.currentSalesInfo?.ticket === "number"
                      ? transition.currentSalesInfo.ticket
                      : sourceLead?.ticket ?? null,
                  contractDueDate:
                    typeof transition.currentSalesInfo?.contractDueDate === "string"
                      ? transition.currentSalesInfo.contractDueDate
                      : sourceLead?.contractDueDate ?? null,
                  soldPlan:
                    typeof transition.currentSalesInfo?.soldPlan === "string"
                      ? transition.currentSalesInfo.soldPlan
                      : sourceLead?.soldPlan ?? null,
                },
              });
            } else {
              setPendingSalesInfoGateDrop(null);
            }

            toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
            return output;
          }

          if (transition.blockerType === "closer_required") {
            const sourceLead =
              fallbackContext
                ? dataRef.current[fallbackContext.from]?.find((lead) => lead.id === leadId) ?? null
                : null;

            if (fallbackContext) {
              setPendingCloserGateDrop({
                leadId,
                from: fallbackContext.from,
                to: fallbackContext.to,
                trigger: trigger ? { ...trigger } : undefined,
                currentCloserId: sourceLead?.closerId ?? null,
              });
            } else {
              setPendingCloserGateDrop(null);
            }

            toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
            return output;
          }

          if (transition.blockerType === "lead_info_required") {
            const sourceLead =
              fallbackContext
                ? dataRef.current[fallbackContext.from]?.find((lead) => lead.id === leadId) ?? null
                : null;
            const missingFields = Array.isArray(transition.missingLeadFields)
              ? transition.missingLeadFields
              : [];
            const currentLeadInfo: LeadInfoInitialValues = {
              age:
                typeof transition.currentLeadInfo?.age === "string"
                  ? transition.currentLeadInfo.age
                  : sourceLead?.age ?? null,
              currentHealthPlan:
                typeof transition.currentLeadInfo?.currentHealthPlan === "string"
                  ? transition.currentLeadInfo.currentHealthPlan
                  : sourceLead?.currentHealthPlan ?? null,
              referenceHospital:
                typeof transition.currentLeadInfo?.referenceHospital === "string"
                  ? transition.currentLeadInfo.referenceHospital
                  : sourceLead?.referenceHospital ?? null,
              ongoingTreatment:
                typeof transition.currentLeadInfo?.ongoingTreatment === "string"
                  ? transition.currentLeadInfo.ongoingTreatment
                  : sourceLead?.currentTreatment ?? null,
              email:
                typeof transition.currentLeadInfo?.email === "string"
                  ? transition.currentLeadInfo.email
                  : sourceLead?.email ?? null,
              phone:
                typeof transition.currentLeadInfo?.phone === "string"
                  ? transition.currentLeadInfo.phone
                  : sourceLead?.phone ?? null,
              cnpj:
                typeof transition.currentLeadInfo?.cnpj === "string"
                  ? transition.currentLeadInfo.cnpj
                  : sourceLead?.cnpj ?? null,
            };

            if (fallbackContext) {
              setPendingLeadInfoGateDrop({
                leadId,
                from: fallbackContext.from,
                to: fallbackContext.to,
                trigger: trigger ? { ...trigger } : undefined,
                missingFields,
                currentLeadInfo,
              });
            } else {
              setPendingLeadInfoGateDrop(null);
            }

            const missingFieldsText = formatMissingLeadFields(missingFields);
            toast.warning(
              missingFieldsText
                ? `${transitionMessage} Faltam: ${missingFieldsText}.`
                : transitionMessage,
              { id: loadingToast, duration: 6000 }
            );
            return output;
          }

          if (
            transition.blockerType === "confirmation" ||
            transition.blockerType === "future_sale_trigger" ||
            transition.blockerType === "loss_reason_trigger"
          ) {
            const confirmationRuleId =
              typeof transition.confirmationRuleId === "string"
                ? transition.confirmationRuleId
                : null;
            const confirmationMessage =
              transition.confirmationMessage ||
              (transition.blockerType === "confirmation"
                ? "Confirmação adicional é necessária para concluir esta transição."
                : null);

            setPendingStatusTriggerDrop((prev) => {
              if (prev && prev.leadId === leadId && prev.to === newStatus) {
                return {
                  ...prev,
                  confirmationRuleId,
                  confirmationMessage,
                };
              }

              if (!fallbackContext) {
                return prev;
              }

              return {
                leadId,
                from: fallbackContext.from,
                to: fallbackContext.to,
                confirmationRuleId,
                confirmationMessage,
              };
            });

            toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
            return output;
          }

          if (transition.blockerType === "finalize_contract") {
            if (fallbackContext) {
              setPendingFinalizeDrop({
                leadId,
                from: fallbackContext.from,
              });
            } else {
              setPendingFinalizeDrop(null);
            }

            toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
            return output;
          }

          if (transition.blockerType === "schedule_required") {
            if (fallbackContext) {
              setPendingScheduledDrop({
                leadId,
                from: fallbackContext.from,
              });
            } else {
              setPendingScheduledDrop(null);
            }

            toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
            return output;
          }

          throw new Error(transitionMessage);
        }

        if (!output.isValid) {
          throw new Error(output.errorMessages?.[0] || 'Erro ao atualizar status do lead');
        }

        const statusLabels: Record<ColumnKey, string> = {
          'new_opportunity': 'Nova Oportunidade',
          'scheduled': 'Agendado',
          'no_show': 'Não Compareceu',
          'pricingRequest': 'Solicitação de Preço',
          'future_sale': 'Venda Futura',
          'offerNegotiation': 'Negociação de Proposta',
          'pending_documents': 'Documentos Pendentes',
          'offerSubmission': 'Proposta Enviada',
          'dps_agreement': 'Acordo DPS',
          'invoicePayment': 'Pagamento de Fatura',
          'disqualified': 'Desqualificado',
          'opportunityLost': 'Oportunidade Perdida',
          'operator_denied': 'Operadora Negou',
          'contract_finalized': 'Contrato Finalizado'
        };

        toast.success(`Status atualizado para: ${statusLabels[newStatus] || newStatus}`, {
          id: loadingToast,
          duration: 3000,
        });
        return output;
      } catch (error) {
        // O optimistic update só é aplicado após sucesso, então em caso de erro o
        // estado local permanece inalterado. Não há necessidade de refetch.
        console.error('Erro ao atualizar status do lead:', error);

        toast.error(error instanceof Error ? error.message : 'Erro ao atualizar status do lead.', {
          id: loadingToast,
          duration: 4000,
        });
        return null;
      }
    },
    [activeTeamId, pendingStatusTriggerDrop, supabaseId]
  );

  const onDrop = useCallback(
    (e: React.DragEvent, to: ColumnKey) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const { leadId, from } = JSON.parse(raw) as { leadId: string; from: ColumnKey };
      if (from === to) return;

      if (!isAllowedStatusTransitionFromProductGates(transitionGates, from, to)) {
        toast.error("Esta transição de status não é permitida pelas regras configuradas.");
        return;
      }

      void (async () => {
        const result = await updateLeadStatusInAPI(leadId, to, undefined, { from, to });
        if (!result?.isValid) return;

        const payload =
          result.result && typeof result.result === "object"
            ? (result.result as Partial<Lead>)
            : {};

        moveLeadBetweenColumns(leadId, from, to, payload);
      })();
    },
    [moveLeadBetweenColumns, updateLeadStatusInAPI, transitionGates]
  );

  const finalizeContract = useCallback(
    async (leadId: string, contractData: FinalizeContractData) => {
      try {
        const { contractFile: _contractFile, ...rest } = contractData;
        const apiPayload = {
          ...rest,
          contractHolder: {
            ...rest.contractHolder,
            birthDate:
              rest.contractHolder.birthDate instanceof Date
                ? rest.contractHolder.birthDate.toISOString()
                : rest.contractHolder.birthDate,
          },
          dependents: rest.dependents.map((d) => ({
            name: d.name,
            birthDate: d.birthDate instanceof Date ? d.birthDate.toISOString() : d.birthDate,
            parentesco: d.parentesco,
            document: d.document,
          })),
        };
        const response = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-supabase-user-id': supabaseId
          },
          body: JSON.stringify(apiPayload)
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.[0] || 'Erro ao finalizar contrato');
        }

        const leadPatch =
          result?.result && typeof result.result === "object" && result.result.lead
            ? (result.result.lead as Partial<Lead>)
            : {};
        const finalizedPatch: Partial<Lead> = {
          ...leadPatch,
          status: "contract_finalized",
        };

        const currentData = dataRef.current;
        const fromColumn = (Object.keys(currentData) as ColumnKey[]).find((key) =>
          (currentData[key] || []).some((l) => l.id === leadId)
        );

        if (fromColumn && fromColumn !== "contract_finalized") {
          moveLeadBetweenColumns(leadId, fromColumn, "contract_finalized", finalizedPatch);
        } else {
          patchLead(leadId, finalizedPatch);
        }
      } catch (error) {
        console.error('Erro ao finalizar contrato:', error);
        throw error;
      }
    },
    [moveLeadBetweenColumns, patchLead, supabaseId]
  );


  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearPendingScheduledDrop = useCallback(() => {
    setPendingScheduledDrop(null);
  }, []);

  const clearPendingStatusTriggerDrop = useCallback(() => {
    setPendingStatusTriggerDrop(null);
  }, []);

  const clearPendingMeetingHealdGateDrop = useCallback(() => {
    setPendingMeetingHealdGateDrop(null);
  }, []);

  const clearPendingSalesInfoGateDrop = useCallback(() => {
    setPendingSalesInfoGateDrop(null);
  }, []);

  const clearPendingCloserGateDrop = useCallback(() => {
    setPendingCloserGateDrop(null);
  }, []);

  const clearPendingLeadInfoGateDrop = useCallback(() => {
    setPendingLeadInfoGateDrop(null);
  }, []);

  const clearPendingFinalizeDrop = useCallback(() => {
    setPendingFinalizeDrop(null);
  }, []);

  const applyPendingMeetingHealdGateTransition = useCallback(async (): Promise<boolean> => {
    if (!pendingMeetingHealdGateDrop) return false;
    if (!pendingMeetingHealdGateDrop.canConfirmMeetingHeald) return false;

    const result = await updateLeadStatusInAPI(
      pendingMeetingHealdGateDrop.leadId,
      pendingMeetingHealdGateDrop.to,
      {
        ...(pendingMeetingHealdGateDrop.trigger ?? {}),
        meetingHeald: "yes",
      },
      { from: pendingMeetingHealdGateDrop.from, to: pendingMeetingHealdGateDrop.to }
    );

    if (!result?.isValid) return false;

    const payload =
      result.result && typeof result.result === "object" ? (result.result as Partial<Lead>) : {};

    moveLeadBetweenColumns(
      pendingMeetingHealdGateDrop.leadId,
      pendingMeetingHealdGateDrop.from,
      pendingMeetingHealdGateDrop.to,
      payload
    );
    setPendingMeetingHealdGateDrop(null);
    return true;
  }, [moveLeadBetweenColumns, pendingMeetingHealdGateDrop, updateLeadStatusInAPI]);

  const applyPendingSalesInfoGateTransition = useCallback(
    async (payload: SalesInfoPayload): Promise<boolean> => {
      if (!pendingSalesInfoGateDrop) return false;

      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${pendingSalesInfoGateDrop.leadId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify(payload),
        });

        const salesResult = await response.json().catch(() => null);
        if (!response.ok || !salesResult?.isValid) {
          throw new Error(
            salesResult?.errorMessages?.[0] || "Erro ao salvar informações de venda do lead."
          );
        }

        const salesPatch =
          salesResult.result && typeof salesResult.result === "object"
            ? (salesResult.result as Partial<Lead>)
            : {};
        patchLead(pendingSalesInfoGateDrop.leadId, salesPatch);

        const statusResult = await updateLeadStatusInAPI(
          pendingSalesInfoGateDrop.leadId,
          pendingSalesInfoGateDrop.to,
          pendingSalesInfoGateDrop.trigger,
          { from: pendingSalesInfoGateDrop.from, to: pendingSalesInfoGateDrop.to }
        );
        if (!statusResult?.isValid) return false;

        const statusPatch =
          statusResult.result && typeof statusResult.result === "object"
            ? (statusResult.result as Partial<Lead>)
            : {};

        moveLeadBetweenColumns(
          pendingSalesInfoGateDrop.leadId,
          pendingSalesInfoGateDrop.from,
          pendingSalesInfoGateDrop.to,
          statusPatch
        );
        setPendingSalesInfoGateDrop(null);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao salvar informações de venda do lead."
        );
        return false;
      }
    },
    [activeTeamId, moveLeadBetweenColumns, patchLead, pendingSalesInfoGateDrop, supabaseId, updateLeadStatusInAPI]
  );

  const applyPendingCloserGateTransition = useCallback(
    async (payload: CloserRequirementPayload): Promise<boolean> => {
      if (!pendingCloserGateDrop) return false;

      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${pendingCloserGateDrop.leadId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify({ closerId: payload.closerId }),
        });

        const closerResult = await response.json().catch(() => null);
        if (!response.ok || !closerResult?.isValid) {
          throw new Error(
            closerResult?.errorMessages?.[0] || "Erro ao salvar closer do lead."
          );
        }

        const closerPatch =
          closerResult.result && typeof closerResult.result === "object"
            ? (closerResult.result as Partial<Lead>)
            : {};
        patchLead(pendingCloserGateDrop.leadId, closerPatch);

        const statusResult = await updateLeadStatusInAPI(
          pendingCloserGateDrop.leadId,
          pendingCloserGateDrop.to,
          pendingCloserGateDrop.trigger,
          { from: pendingCloserGateDrop.from, to: pendingCloserGateDrop.to }
        );
        if (!statusResult?.isValid) return false;

        const statusPatch =
          statusResult.result && typeof statusResult.result === "object"
            ? (statusResult.result as Partial<Lead>)
            : {};

        moveLeadBetweenColumns(
          pendingCloserGateDrop.leadId,
          pendingCloserGateDrop.from,
          pendingCloserGateDrop.to,
          statusPatch
        );
        setPendingCloserGateDrop(null);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao salvar closer do lead."
        );
        return false;
      }
    },
    [activeTeamId, moveLeadBetweenColumns, patchLead, pendingCloserGateDrop, supabaseId, updateLeadStatusInAPI]
  );

  const applyPendingLeadInfoGateTransition = useCallback(
    async (payload: LeadInfoPayload): Promise<boolean> => {
      if (!pendingLeadInfoGateDrop) return false;

      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${pendingLeadInfoGateDrop.leadId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify(mapLeadInfoPayloadForUpdate(payload)),
        });

        const leadInfoResult = await response.json().catch(() => null);
        if (!response.ok || !leadInfoResult?.isValid) {
          throw new Error(
            leadInfoResult?.errorMessages?.[0] || "Erro ao salvar informações do lead."
          );
        }

        const leadInfoPatch =
          leadInfoResult.result && typeof leadInfoResult.result === "object"
            ? (leadInfoResult.result as Partial<Lead>)
            : {};
        patchLead(pendingLeadInfoGateDrop.leadId, leadInfoPatch);

        const statusResult = await updateLeadStatusInAPI(
          pendingLeadInfoGateDrop.leadId,
          pendingLeadInfoGateDrop.to,
          pendingLeadInfoGateDrop.trigger,
          { from: pendingLeadInfoGateDrop.from, to: pendingLeadInfoGateDrop.to }
        );
        if (!statusResult?.isValid) return false;

        const statusPatch =
          statusResult.result && typeof statusResult.result === "object"
            ? (statusResult.result as Partial<Lead>)
            : {};

        moveLeadBetweenColumns(
          pendingLeadInfoGateDrop.leadId,
          pendingLeadInfoGateDrop.from,
          pendingLeadInfoGateDrop.to,
          statusPatch
        );
        setPendingLeadInfoGateDrop(null);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao salvar informações do lead."
        );
        return false;
      }
    },
    [activeTeamId, moveLeadBetweenColumns, patchLead, pendingLeadInfoGateDrop, supabaseId, updateLeadStatusInAPI]
  );

  const applyPendingStatusTriggerTransition = useCallback(
    async (trigger: {
      followUpAt?: string;
      followUpNotes?: string;
      reason?: string;
      reasonDetails?: string;
      confirmRuleId?: string;
    }): Promise<boolean> => {
      if (!pendingStatusTriggerDrop) return false;

      const result = await updateLeadStatusInAPI(
        pendingStatusTriggerDrop.leadId,
        pendingStatusTriggerDrop.to,
        {
          ...trigger,
          confirmRuleId:
            trigger.confirmRuleId ||
            pendingStatusTriggerDrop.confirmationRuleId ||
            undefined,
        }
      );

      if (!result?.isValid) return false;

      const payload =
        result.result && typeof result.result === "object"
          ? (result.result as Partial<Lead>)
          : {};

      moveLeadBetweenColumns(
        pendingStatusTriggerDrop.leadId,
        pendingStatusTriggerDrop.from,
        pendingStatusTriggerDrop.to,
        payload
      );
      setPendingStatusTriggerDrop(null);
      return true;
    },
    [moveLeadBetweenColumns, pendingStatusTriggerDrop, updateLeadStatusInAPI]
  );

  const applyScheduledTransition = useCallback(
    (from: ColumnKey, payload: Partial<Lead> & Pick<Lead, "id" | "status">) => {
      moveLeadBetweenColumns(payload.id, from, "scheduled", payload);
      setPendingScheduledDrop(null);
    },
    [moveLeadBetweenColumns]
  );

  // Mapeamento de status para labels legíveis
  const statusLabels: Record<ColumnKey, string> = useMemo(() => {
    const labels: Record<ColumnKey, string> = {} as Record<ColumnKey, string>;
    COLUMNS.forEach(({ key, title }) => {
      labels[key] = title;
    });
    return labels;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inQuery = (l: Lead) =>
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.leadCode.toLowerCase().includes(q) ||
      formatDate(l.createdAt, tz).includes(q);
    const inResponsible = (l: Lead) =>
      assignedUsers.length === 0 || (l.assignedTo ? assignedUsers.includes(l.assignedTo) : false);
    const inCloser = (l: Lead) =>
      closerFilter.length === 0 || (l.closerId ? closerFilter.includes(l.closerId) : false);
    const inMeetingsHeld = (l: Lead) => !onlyMeetingsHeld || l.meetingHeald === "yes";
    const inTransfer = (l: Lead) => !onlyTransfer || l.isTransfer === true;
    const inDraft = (l: Lead) => {
      const isDraftLeadRow = l.status === null || l.status === undefined;
      if (onlyDraft) return isDraftLeadRow;
      return !isDraftLeadRow;
    };
    const inPeriod = (l: Lead) => {
      const createdKey = formatDateKey(l.createdAt, tz);
      if (!createdKey) return false;
      const afterStart = !periodStart || createdKey >= periodStart;
      const beforeEnd = !periodEnd || createdKey <= periodEnd;
      return afterStart && beforeEnd;
    };
    const inScheduledPeriod = (l: Lead) => {
      if (!scheduledPeriodStart && !scheduledPeriodEnd) return true;
      if (!l.meetingDate) return false;
      const meetingDateKey = formatDateKey(l.meetingDate, tz);
      if (!meetingDateKey) return false;
      const afterStart = !scheduledPeriodStart || meetingDateKey >= scheduledPeriodStart;
      const beforeEnd = !scheduledPeriodEnd || meetingDateKey <= scheduledPeriodEnd;
      return afterStart && beforeEnd;
    };
    
    const next: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
    
    // Garante que todas as colunas existam no resultado filtrado
    COLUMNS.forEach(({ key }) => {
      const columnData = data[key] || []; // Fallback para array vazio se não existir
      const statusSelected = statusFilter.length === 0 || statusFilter.includes(key);
      next[key] = statusSelected
        ? columnData.filter(
            (l) =>
              inQuery(l) &&
              inResponsible(l) &&
              inCloser(l) &&
              inMeetingsHeld(l) &&
              inTransfer(l) &&
              inDraft(l) &&
              inPeriod(l) &&
              inScheduledPeriod(l)
          )
        : [];
    });
    
    return next;
  }, [
    data,
    query,
    assignedUsers,
    closerFilter,
    onlyMeetingsHeld,
    onlyTransfer,
    onlyDraft,
    periodStart,
    periodEnd,
    scheduledPeriodStart,
    scheduledPeriodEnd,
    statusFilter,
    tz,
  ]);

  const responsaveis = useMemo(() => {
    return sdrMembers
      .map((sdr) => ({
        id: sdr.id,
        name: sdr.name || sdr.email,
        avatarUrl: sdr.avatarImageUrl || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sdrMembers]);

  const refreshLeads = useCallback(async () => {
    await loadLeads({ force: true });
  }, [loadLeads]);

  const value = useMemo<IBoardContextState>(
    () => ({
      isLoading,
      query,
      setQuery,
      onlyMeetingsHeld,
      setOnlyMeetingsHeld,
      onlyTransfer,
    onlyDraft,
      setOnlyTransfer,
      leadCardDisplay,
      setLeadCardDisplay,
      data,
      filtered,
      periodStart,
      setPeriodStart,
      periodEnd,
      setPeriodEnd,
      assignedUsers,
      setAssignedUsers,
      statusFilter,
      setStatusFilter,
      closerFilter,
      setCloserFilter,
      customFieldFilters,
      setCustomFieldFilters,
      customFieldSort,
      setCustomFieldSort,
      taskOwners: responsaveis,
      statusLabels,
      errors,
      open,
      user,
      userLoading,
      setOpen,
      selected,
      onDragOver,
      clearErrors,
      handleCardClick,
      handleCardMouseDown,
      handleCardDragStart,
      openNewLeadDialog,
      onDrop,
      onDragStart,
      refreshLeads,
      patchLead,
      pendingScheduledDrop,
      clearPendingScheduledDrop,
      applyScheduledTransition,
      pendingStatusTriggerDrop,
      clearPendingStatusTriggerDrop,
      applyPendingStatusTriggerTransition,
      pendingMeetingHealdGateDrop,
      clearPendingMeetingHealdGateDrop,
      applyPendingMeetingHealdGateTransition,
      pendingSalesInfoGateDrop,
      clearPendingSalesInfoGateDrop,
      applyPendingSalesInfoGateTransition,
      pendingCloserGateDrop,
      clearPendingCloserGateDrop,
      applyPendingCloserGateTransition,
      pendingLeadInfoGateDrop,
      clearPendingLeadInfoGateDrop,
      applyPendingLeadInfoGateTransition,
      pendingFinalizeDrop,
      clearPendingFinalizeDrop,
      finalizeContract,
    }),
    [
      isLoading,
      query,
      onlyMeetingsHeld,
      onlyTransfer,
    onlyDraft,
      leadCardDisplay,
      data,
      filtered,
      periodStart,
      periodEnd,
      assignedUsers,
      statusFilter,
      closerFilter,
      customFieldFilters,
      customFieldSort,
      responsaveis,
      statusLabels,
      errors,
      open,
      user,
      userLoading,
      selected,
      onDragOver,
      clearErrors,
      handleCardClick,
      handleCardMouseDown,
      handleCardDragStart,
      openNewLeadDialog,
      onDrop,
      onDragStart,
      refreshLeads,
      patchLead,
      pendingScheduledDrop,
      clearPendingScheduledDrop,
      applyScheduledTransition,
      pendingStatusTriggerDrop,
      clearPendingStatusTriggerDrop,
      applyPendingStatusTriggerTransition,
      pendingMeetingHealdGateDrop,
      clearPendingMeetingHealdGateDrop,
      applyPendingMeetingHealdGateTransition,
      pendingSalesInfoGateDrop,
      clearPendingSalesInfoGateDrop,
      applyPendingSalesInfoGateTransition,
      pendingCloserGateDrop,
      clearPendingCloserGateDrop,
      applyPendingCloserGateTransition,
      pendingLeadInfoGateDrop,
      clearPendingLeadInfoGateDrop,
      applyPendingLeadInfoGateTransition,
      pendingFinalizeDrop,
      clearPendingFinalizeDrop,
      finalizeContract,
    ]
  );
  
  return (
    <BoardContext.Provider value={value}>
      {children}
    </BoardContext.Provider>
  );
}

// Exportar constantes úteis
export { COLUMNS, formatDate };
