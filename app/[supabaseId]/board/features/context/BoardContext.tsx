import { createContext, ReactNode, useMemo, useState, useEffect } from "react";
import { IBoardService } from "../services/IBoardServices";
import { Lead, ColumnKey } from "./BoardTypes";
import { createBoardService } from "../services/BoardService";
import { useParams } from "next/navigation";
import { ProfileResponseDTO } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { FinalizeContractData } from "../container/FinalizeContractDialog";

interface IBoardProviderProps {
  children: ReactNode;
  boardService?: IBoardService;
}

interface Responsavel {
  id: string;
  name: string;
}

interface IBoardContextState {
  isLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  data: Record<ColumnKey, Lead[]>;
  filtered: Record<ColumnKey, Lead[]>;
  periodStart: string; 
  setPeriodStart: (date: string) => void;
  periodEnd: string;
  setPeriodEnd: (date: string) => void;
  assignedUser: string; 
  setAssignedUser: (user: string) => void;
  responsaveis: Responsavel[];
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
  finalizeContract: (leadId: string, data: FinalizeContractData) => Promise<void>;
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

export const BoardContext = createContext<IBoardContextState | undefined>(undefined);

export const BoardProvider: React.FC<IBoardProviderProps> = ({ 
  children, 
  boardService = createBoardService()
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
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
  const [assignedUser, setAssignedUser] = useState<string>("todos");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [user, setUser] = useState<ProfileResponseDTO | null>(null);
  const [userLoading, setUserLoading] = useState(true);

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
      setErrors({}); // Limpa erros anteriores
      
      if (!supabaseId) {
        setErrors({ api: 'ID do usuário não encontrado' });
        return;
      }
      
      const result = await boardService.fetchLeads(supabaseId, 'manager'); // Assumindo que é um manager por enquanto

      if (result.isValid && result.result) {
        // Organizar leads por status (coluna)
        const leadsGroupedByStatus: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
        
        // Inicializa todas as colunas com arrays vazios
        COLUMNS.forEach(({ key }) => {
          leadsGroupedByStatus[key] = [];
        });
        
        // Distribui os leads nas colunas corretas baseado no status
        result.result.forEach((lead: Lead) => {
          if (leadsGroupedByStatus[lead.status]) {
            leadsGroupedByStatus[lead.status].push(lead);
          }
        });
        
        setData(leadsGroupedByStatus);
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
    
      const onDrop = (e: React.DragEvent, to: ColumnKey) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        const { leadId, from } = JSON.parse(raw) as { leadId: string; from: ColumnKey };
        if (from === to) return;
    
        setData((prev) => {
          const fromArr = [...prev[from]];
          const toArr = [...prev[to]];
          const idx = fromArr.findIndex((l) => l.id === leadId);
          if (idx === -1) return prev;
          const [moved] = fromArr.splice(idx, 1);
          
          // Atualiza o status do lead
          moved.status = to;
          
          toArr.unshift(moved); // adiciona no topo do destino
          
          // TODO: Fazer chamada para API para atualizar o status no backend
          updateLeadStatusInAPI(leadId, to);
          
          return { ...prev, [from]: fromArr, [to]: toArr };
        });
      };

      // Função para atualizar status na API
      const updateLeadStatusInAPI = async (leadId: string, newStatus: ColumnKey) => {
        try {
          const response = await fetch(`/api/v1/leads/${leadId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-supabase-user-id': supabaseId
            },
            body: JSON.stringify({ status: newStatus })
          });

          if (!response.ok) {
            console.error('Erro ao atualizar status do lead');
            // TODO: Implementar rollback do estado local em caso de erro
          }
        } catch (error) {
          console.error('Erro ao atualizar status do lead:', error);
          // TODO: Implementar rollback do estado local em caso de erro
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
          await loadLeads(); // Recarrega todos os leads para garantir consistência
        } catch (error) {
          console.error('Erro ao finalizar contrato:', error);
          throw error;
        }
      };
    

  const clearErrors = () => {
    setErrors({});
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inQuery = (l: Lead) => !q || l.name.toLowerCase().includes(q) || formatDate(l.createdAt).includes(q);
    const inResponsible = (l: Lead) => assignedUser === "todos" || l.assignedTo === assignedUser;
    const inPeriod = (l: Lead) => {
      const d = l.createdAt; // ISO date string
      const afterStart = !periodStart || d >= periodStart;
      const beforeEnd = !periodEnd || d <= periodEnd;
      return afterStart && beforeEnd;
    };
    
    const next: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
    
    // Garante que todas as colunas existam no resultado filtrado
    COLUMNS.forEach(({ key }) => {
      const columnData = data[key] || []; // Fallback para array vazio se não existir
      next[key] = columnData.filter((l) => inQuery(l) && inResponsible(l) && inPeriod(l));
    });
    
    return next;
  }, [data, query, assignedUser, periodStart, periodEnd]);

  const responsaveis = useMemo(() => {
    const responsaveisMap = new Map<string, string>();
    COLUMNS.forEach(({ key }) => {
      const columnData = data[key] || []; // Fallback para array vazio se não existir
      columnData.forEach((l) => {
        if (l.assignedTo && l.assignee) {
          // Usar o nome completo se disponível, senão o email, senão o ID
          const displayName = l.assignee.fullName || l.assignee.email || l.assignedTo;
          responsaveisMap.set(l.assignedTo, displayName);
        }
      });
    });
    return Array.from(responsaveisMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const value: IBoardContextState = {
    isLoading,
    query,
    setQuery,
    data,
    filtered,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    assignedUser,
    setAssignedUser,
    responsaveis,
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
    refreshLeads: loadLeads,
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