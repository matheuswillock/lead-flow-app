'use client';

import { createContext, ReactNode, useMemo, useState, useEffect, useRef, useCallback } from "react";
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

interface IPipelineProviderProps {
  children: ReactNode;
  pipelineService?: IBoardService;
}

interface TaskOwner {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

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
}

const COLUMNS: { key: ColumnKey; title: string }[] = [
  { key: "new_opportunity", title: "Nova oportunidade" },
  { key: "scheduled", title: "Agendado" },
  { key: "no_show", title: "No Show" },
  { key: "pricingRequest", title: "Cotação" },
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
  pipelineService
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const user: ProfileResponseDTO | null = contextUser;
  const accessDeniedShownRef = useRef(false);

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
          
          // Armazenar todos os leads em um array flat
          setAllLeads(result.result);

          // Se há um lead selecionado, atualizar com os novos dados
          const currentSelected = selectedRef.current;
          if (currentSelected && currentSelected.id) {
            const updatedLead = result.result.find((l: Lead) => l.id === currentSelected.id);
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
  }, [activeFunctions, activeRole, activeTeamId, resolvedPipelineService, supabaseId]);

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
    const q = query.trim().toLowerCase();
    
    return allLeads.filter((lead) => {
      // Filtro por query (nome ou data)
      const matchesQuery = !q || 
        lead.name.toLowerCase().includes(q) || 
        lead.leadCode.toLowerCase().includes(q) ||
        formatDate(lead.createdAt).includes(q);
      
      // Filtro por responsável
      const matchesResponsible = assignedUser === "todos" || lead.assignedTo === assignedUser;
      
      // Filtro por período
      const d = lead.createdAt;
      const afterStart = !periodStart || d >= periodStart;
      const beforeEnd = !periodEnd || d <= periodEnd;
      const matchesPeriod = afterStart && beforeEnd;

      const matchesMeetingsHeld = !onlyMeetingsHeld || lead.meetingHeald === "yes";

      return matchesQuery && matchesResponsible && matchesMeetingsHeld && matchesPeriod;
    });
  }, [allLeads, query, assignedUser, onlyMeetingsHeld, periodStart, periodEnd]);

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
    statusLabels
  };
  
  return (
    <PipelineContext.Provider value={value}>
      {children}
    </PipelineContext.Provider>
  );
}

// Exportar constantes úteis
export { COLUMNS, formatDate };
