'use client';

import { createContext, ReactNode, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Lead, ColumnKey } from "./PipelineTypes";
import { createBoardService } from "@/app/[supabaseId]/board/features/services/BoardService";
import { IBoardService } from "@/app/[supabaseId]/board/features/services/IBoardServices";
import { useParams } from "next/navigation";
import { ProfileResponseDTO } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";

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
  pipelineService = createBoardService()
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [assignedUser, setAssignedUser] = useState<string>("todos");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [user, setUser] = useState<ProfileResponseDTO | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Mapeamento de status para labels legíveis
  const statusLabels: Record<ColumnKey, string> = useMemo(() => {
    const labels: Record<ColumnKey, string> = {} as Record<ColumnKey, string>;
    COLUMNS.forEach(({ key, title }) => {
      labels[key] = title;
    });
    return labels;
  }, []);

  // Função para carregar dados do usuário
  const loadUser = async () => {
    try {
      setUserLoading(true);
      
      if (!supabaseId) {
        console.error('ID do usuário não encontrado');
        return;
      }
      
      const response = await fetch(`/api/v1/profiles/${supabaseId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do usuário');
      }
      
      const result = await response.json();
      
      if (result.isValid && result.result) {
        setUser(result.result);
      } else {
        console.error('Erro ao carregar usuário:', result.errorMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setUserLoading(false);
    }
  };

  // Função para carregar leads da API
  const loadLeads = async () => {
    try {
      setIsLoading(true);
      setErrors({});
      
      if (!supabaseId) {
        setErrors({ api: 'ID do usuário não encontrado' });
        return;
      }
      
      const result = await pipelineService.fetchLeads(supabaseId, 'manager');

      if (result.isValid && result.result) {
        console.info('[PipelineContext] Leads fetched from API:', result.result.length, 'leads');
        
        // Armazenar todos os leads em um array flat
        setAllLeads(result.result);

        // Se há um lead selecionado, atualizar com os novos dados
        if (selected && selected.id) {
          const updatedLead = result.result.find((l: Lead) => l.id === selected.id);
          if (updatedLead) {
            const hasChanges = 
              updatedLead.meetingDate !== selected.meetingDate ||
              updatedLead.status !== selected.status ||
              updatedLead.name !== selected.name ||
              updatedLead.email !== selected.email ||
              updatedLead.phone !== selected.phone;

            if (hasChanges) {
              console.info('[PipelineContext] ✅ Updating selected lead with fresh data');
              
              // Notificar usuário sobre mudanças específicas
              if (updatedLead.meetingDate !== selected.meetingDate && updatedLead.meetingDate) {
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
      setIsLoading(false);
    }
  };

  // Carregar dados quando o componente montar
  useEffect(() => {
    loadUser();
    loadLeads();
  }, [supabaseId]);

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

      await loadLeads();
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

  // Filtrar leads
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    return allLeads.filter((lead) => {
      // Filtro por query (nome ou data)
      const matchesQuery = !q || 
        lead.name.toLowerCase().includes(q) || 
        formatDate(lead.createdAt).includes(q);
      
      // Filtro por responsável
      const matchesResponsible = assignedUser === "todos" || lead.assignedTo === assignedUser;
      
      // Filtro por período
      const d = lead.createdAt;
      const afterStart = !periodStart || d >= periodStart;
      const beforeEnd = !periodEnd || d <= periodEnd;
      const matchesPeriod = afterStart && beforeEnd;
      
      return matchesQuery && matchesResponsible && matchesPeriod;
    });
  }, [allLeads, query, assignedUser, periodStart, periodEnd]);

  // Extrair lista de responsáveis únicos
  const taskOwners = useMemo(() => {
    // Usar todos os usuários associados ao invés de apenas aqueles com leads atribuídos
    if (!user?.usersAssociated || user.usersAssociated.length === 0) {
      return [];
    }
    
    return user.usersAssociated
      .map((u) => ({
        id: u.id,
        name: u.name || u.email,
        avatarUrl: u.avatarImageUrl || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [user]);

  const value: IPipelineContextState = {
    isLoading,
    query,
    setQuery,
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
    refreshLeads: loadLeads,
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
