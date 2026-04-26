import { createContext, ReactNode, useMemo, useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
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
import type { CrmFiltersState } from "@/app/[supabaseId]/crm/features/context/CrmTypes";
import {
  createLeadTimeRulesVersion,
  EMPTY_TEAM_STATUS_RULES,
  resolveLeadTimeState,
  type TeamStatusRulesResponse,
} from "@/lib/teamStatusRules";
import { formatInTz, formatLocalDateValue } from "@/lib/dates";

interface IBoardProviderProps {
  children: ReactNode;
  boardService?: IBoardService;
  externalFilters?: CrmFiltersState;
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

interface IBoardContextState {
  isLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  onlyMeetingsHeld: boolean;
  setOnlyMeetingsHeld: (value: boolean) => void;
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
  }) => Promise<void>;
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
    return formatInTz(new Date(iso), "dd/MM/yyyy", tz);
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

export const BoardContext = createContext<IBoardContextState | undefined>(undefined);

export const BoardProvider: React.FC<IBoardProviderProps> = ({ 
  children, 
  boardService,
  externalFilters,
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyMeetingsHeld, setOnlyMeetingsHeld] = useState(false);
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
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ColumnKey[]>([]);
  const [closerFilter, setCloserFilter] = useState<string[]>([]);
  const [teamStatusRules, setTeamStatusRules] =
    useState<TeamStatusRulesResponse>(EMPTY_TEAM_STATUS_RULES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingScheduledDrop, setPendingScheduledDrop] = useState<PendingScheduledDrop | null>(null);
  const [pendingStatusTriggerDrop, setPendingStatusTriggerDrop] = useState<PendingStatusTriggerDrop | null>(null);

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
    setOnlyMeetingsHeld(externalFilters.onlyMeetingsHeld);
  }, [externalFilters]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const selectedRef = useRef<Lead | null>(null);
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
      console.error("Erro ao carregar configuracoes do card:", error);
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
      console.error("Erro ao salvar configuracoes do card:", error);
    }
  }, [leadCardDisplayStorageKey, leadCardDisplay]);

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
      console.error("[BoardContext] Erro ao carregar regras de status:", error);
      setTeamStatusRules(EMPTY_TEAM_STATUS_RULES);
    }
  }, [activeTeamId, supabaseId]);

  useEffect(() => {
    void loadTeamStatusRules();
  }, [loadTeamStatusRules]);

  // Função para carregar leads da API
  const loadLeads = useCallback(async (options?: { force?: boolean }) => {
    const roleToSend = activeRole || "manager";
    const leadTimeRulesVersion = createLeadTimeRulesVersion(teamStatusRules.leadTimeRules);
    const loadKey = `${supabaseId}:${activeTeamId ?? ""}:${roleToSend}:${(activeFunctions ?? []).slice().sort().join("|")}:${leadTimeRulesVersion}`;

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
        
        const result = await resolvedBoardService.fetchLeads(supabaseId, roleToSend, activeTeamId);

        if (result.isValid && result.result) {
          console.info('[BoardContext] Leads fetched from API:', result.result.length, 'leads');
          lastLeadsLoadKeyRef.current = loadKey;
          
          // Log dos meetingDates para debug
          const leadsWithMeetingDate = result.result.filter((l: Lead) => l.meetingDate);
          if (leadsWithMeetingDate.length > 0) {
            console.info('[BoardContext] Leads with meetingDate:', leadsWithMeetingDate.map((l: Lead) => ({
              id: l.id,
              name: l.name,
              meetingDate: l.meetingDate,
              status: l.status
            })));
          }
          
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

          // Organizar leads por status (coluna)
          const leadsGroupedByStatus: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
          
          // Inicializa todas as colunas com arrays vazios
          COLUMNS.forEach(({ key }) => {
            leadsGroupedByStatus[key] = [];
          });
          
          // Distribui os leads nas colunas corretas baseado no status
          leadsWithLeadTimeState.forEach((lead: Lead) => {
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
                  const meetingDateFormatted = formatInTz(
                    new Date(updatedLead.meetingDate),
                    "dd 'de' MMMM 'de' yyyy HH:mm",
                    tz
                  );
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
  }, [activeFunctions, activeRole, activeTeamId, resolvedBoardService, supabaseId, teamStatusRules.leadTimeRules]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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

  let dragStarted = false
    const handleCardMouseDown = () => { dragStarted = false }

    const handleCardDragStart = (e: React.DragEvent, leadId: string, from: ColumnKey) => {
      dragStarted = true
      onDragStart(e, leadId, from)
    }

    const handleCardClick = (lead: Lead) => {
      if (dragStarted) return
      setSelected(lead)
      setOpen(true)
    }

    const openNewLeadDialog = () => {
      setSelected(null) // Limpa a seleção para indicar que é um novo lead
      setOpen(true)
    }

    const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

      const onDragStart = (e: React.DragEvent, leadId: string, from: ColumnKey) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ leadId, from }));
        e.dataTransfer.effectAllowed = "move";
      };
    
      const moveLeadBetweenColumns = (
        leadId: string,
        from: ColumnKey,
        to: ColumnKey,
        patch?: Partial<Lead>
      ): boolean => {
        let moved = false;

        setData((prev) => {
          const fromArr = [...(prev[from] || [])];
          const toArr = [...(prev[to] || [])];
          const idx = fromArr.findIndex((l) => l.id === leadId);
          if (idx === -1) return prev;

          const [movedLead] = fromArr.splice(idx, 1);
          const updatedLead = { ...movedLead, ...patch, status: to } as Lead;
          const existingIdx = toArr.findIndex((l) => l.id === leadId);
          if (existingIdx !== -1) {
            toArr.splice(existingIdx, 1);
          }
          toArr.unshift(updatedLead);

          moved = true;
          return { ...prev, [from]: fromArr, [to]: toArr };
        });

        if (moved) {
          setSelected((prev) => {
            if (prev?.id !== leadId) return prev;
            return { ...prev, ...patch, status: to } as Lead;
          });
        }

        return moved;
      };

      const onDrop = (e: React.DragEvent, to: ColumnKey) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        const { leadId, from } = JSON.parse(raw) as { leadId: string; from: ColumnKey };
        if (from === to) return;

        if (to === "scheduled") {
          setPendingScheduledDrop({ leadId, from });
          return;
        }

        if (to === "future_sale" || to === "opportunityLost" || to === "operator_denied") {
          setPendingStatusTriggerDrop({
            leadId,
            from,
            to,
            confirmationRuleId: null,
            confirmationMessage: null,
          });
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
          await loadLeads({ force: true });
        })();
      };

      // Função para atualizar status na API
      const updateLeadStatusInAPI = async (
        leadId: string,
        newStatus: ColumnKey,
        trigger?: {
          followUpAt?: string;
          followUpNotes?: string;
          reason?: string;
          reasonDetails?: string;
          confirmRuleId?: string;
        },
        pendingDropContext?: { from: ColumnKey; to: ColumnKey }
      ) => {
        // 🚀 Toast de loading para feedback imediato
        const loadingToast = toast.loading('Atualizando status do lead...');
        
        try {
          const response = await fetch(`/api/v1/leads/${leadId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-supabase-user-id': supabaseId,
              'x-team-id': activeTeamId || ''
            },
            body: JSON.stringify({
              status: newStatus,
              ...(trigger ? { trigger } : {}),
            })
          });

          const result = await response.json().catch(() => null);

          if (!response.ok || !result?.isValid) {
            const requiresConfirmation =
              !!result?.result &&
              typeof result.result === "object" &&
              !!result.result.requiresConfirmation;

            if (requiresConfirmation) {
              const confirmationMessage =
                result?.errorMessages?.[0] ||
                "Confirmação adicional é necessária para concluir esta transição.";
              const confirmationRuleId =
                typeof result?.result?.confirmationRuleId === "string"
                  ? result.result.confirmationRuleId
                  : null;

              setPendingStatusTriggerDrop((prev) => {
                if (prev && prev.leadId === leadId && prev.to === newStatus) {
                  return {
                    ...prev,
                    confirmationRuleId,
                    confirmationMessage,
                  };
                }

                if (!pendingDropContext) {
                  return prev;
                }

                return {
                  leadId,
                  from: pendingDropContext.from,
                  to: pendingDropContext.to,
                  confirmationRuleId,
                  confirmationMessage,
                };
              });

              toast.info(confirmationMessage, { id: loadingToast, duration: 5000 });
              return result;
            }

            throw new Error(result?.errorMessages?.[0] || 'Erro ao atualizar status do lead');
          }
          
          // ✅ Sucesso
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
          return result;
        } catch (error) {
          console.error('Erro ao atualizar status do lead:', error);
          
          // ❌ Erro - Reverter mudança visual
          toast.error(error instanceof Error ? error.message : 'Erro ao atualizar status. Recarregando...', {
            id: loadingToast,
            duration: 4000,
          });
          
          // Recarregar dados para reverter UI
          await loadLeads({ force: true });
          return null;
        }
      };

      // Função para finalizar contrato
      const finalizeContract = async (leadId: string, contractData: FinalizeContractData) => {
        try {
          const response = await fetch(`/api/v1/leads/${leadId}/finalize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-supabase-user-id': supabaseId
            },
            body: JSON.stringify(contractData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errorMessages?.[0] || 'Erro ao finalizar contrato');
          }

          // Atualizar o lead para a coluna de contrato finalizado
          await loadLeads({ force: true }); // Recarrega todos os leads para garantir consistência
        } catch (error) {
          console.error('Erro ao finalizar contrato:', error);
          throw error;
        }
      };
    

  const clearErrors = () => {
    setErrors({});
  };

      const patchLead = (leadId: string, patch: Partial<Lead>) => {
    setData((prev) => {
      const next: Record<ColumnKey, Lead[]> = { ...prev } as Record<ColumnKey, Lead[]>;
      COLUMNS.forEach(({ key }) => {
        const column = prev[key] || [];
        next[key] = column.map((l) => (l.id === leadId ? ({ ...l, ...patch } as Lead) : l));
      });
      return next;
    });
    setSelected((prev) => (prev?.id === leadId ? ({ ...prev, ...patch } as Lead) : prev));
  };

  const clearPendingScheduledDrop = () => {
    setPendingScheduledDrop(null);
  };

  const clearPendingStatusTriggerDrop = () => {
    setPendingStatusTriggerDrop(null);
  };

  const applyPendingStatusTriggerTransition = async (trigger: {
    followUpAt?: string;
    followUpNotes?: string;
    reason?: string;
    reasonDetails?: string;
    confirmRuleId?: string;
  }) => {
    if (!pendingStatusTriggerDrop) return;

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

    if (!result?.isValid) return;

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
    await loadLeads({ force: true });
  };

  const applyScheduledTransition = (
    from: ColumnKey,
    payload: Partial<Lead> & Pick<Lead, "id" | "status">
  ) => {
    moveLeadBetweenColumns(payload.id, from, "scheduled", payload);
    setPendingScheduledDrop(null);
  };

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
    const inPeriod = (l: Lead) => {
      const createdKey = formatDateKey(l.createdAt, tz);
      if (!createdKey) return false;
      const afterStart = !periodStart || createdKey >= periodStart;
      const beforeEnd = !periodEnd || createdKey <= periodEnd;
      return afterStart && beforeEnd;
    };
    
    const next: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
    
    // Garante que todas as colunas existam no resultado filtrado
    COLUMNS.forEach(({ key }) => {
      const columnData = data[key] || []; // Fallback para array vazio se não existir
      const statusSelected = statusFilter.length === 0 || statusFilter.includes(key);
      next[key] = statusSelected
        ? columnData.filter(
            (l) => inQuery(l) && inResponsible(l) && inCloser(l) && inMeetingsHeld(l) && inPeriod(l)
          )
        : [];
    });
    
    return next;
  }, [data, query, assignedUsers, closerFilter, onlyMeetingsHeld, periodStart, periodEnd, statusFilter]);

  const responsaveis = useMemo(() => {
    return sdrMembers
      .map((sdr) => ({
        id: sdr.id,
        name: sdr.name || sdr.email,
        avatarUrl: sdr.avatarImageUrl || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sdrMembers]);

    const value: IBoardContextState = {
      isLoading,
      query,
      setQuery,
      onlyMeetingsHeld,
      setOnlyMeetingsHeld,
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
      refreshLeads: () => loadLeads({ force: true }),
      patchLead,
      pendingScheduledDrop,
      clearPendingScheduledDrop,
      applyScheduledTransition,
      pendingStatusTriggerDrop,
      clearPendingStatusTriggerDrop,
      applyPendingStatusTriggerTransition,
      finalizeContract
    };
  
  return (
    <BoardContext.Provider value={value}>
      {children}
    </BoardContext.Provider>
  );
}

// Exportar constantes úteis
export { COLUMNS, formatDate };
