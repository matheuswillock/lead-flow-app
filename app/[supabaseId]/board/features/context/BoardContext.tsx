import { createContext, ReactNode, useMemo, useState } from "react";
import { IBoardService } from "../services/IBoardServices";
// import { createBoardService } from "./services/BoardService"; // TODO: Implement service integration

interface IBoardProviderProps {
  children: ReactNode;
  boardService?: IBoardService;
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
  responsaveis: string[];
  errors: Record<string, string>;
  open: boolean;
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
    const date = new Date(iso + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

export const BoardContext = createContext<IBoardContextState | undefined>(undefined);

export const BoardProvider: React.FC<IBoardProviderProps> = ({ 
  children, 
  // boardService = createBoardService() // TODO: Implement service integration
}) => {
  const [isLoading] = useState(false); // TODO: Use when implementing service calls
  const [query, setQuery] = useState("");

  // TODO: Replace with service data fetching
  const [data, setData] = useState<Record<ColumnKey, Lead[]>>(() => {
    // Inicializa todas as colunas com arrays vazios
    const initialData: Record<ColumnKey, Lead[]> = {} as Record<ColumnKey, Lead[]>;
    COLUMNS.forEach(({ key }) => {
      initialData[key] = [];
    });
    
    // Adiciona alguns dados de exemplo para teste
    initialData.new_opportunity = [
      {
        id: "1",
        name: "João Silva",
        enteredAt: "2025-09-15",
        responsible: "Maria Santos"
      },
      {
        id: "2", 
        name: "Ana Costa",
        enteredAt: "2025-09-16",
        responsible: "Carlos Lima"
      }
    ];
    
    initialData.scheduled = [
      {
        id: "3",
        name: "Pedro Oliveira", 
        enteredAt: "2025-09-10",
        responsible: "Maria Santos"
      }
    ];
    
    return initialData;
  });

  const [periodStart, setPeriodStart] = useState<string>(""); // yyyy-mm-dd
  const [periodEnd, setPeriodEnd] = useState<string>(""); // yyyy-mm-dd
  const [assignedUser, setAssignedUser] = useState<string>("todos");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

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
          toArr.unshift(moved); // adiciona no topo do destino
          return { ...prev, [from]: fromArr, [to]: toArr };
        });
      };
    

  const clearErrors = () => {
    setErrors({});
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inQuery = (l: Lead) => !q || l.name.toLowerCase().includes(q) || formatDate(l.enteredAt).includes(q);
    const inResponsible = (l: Lead) => assignedUser === "todos" || l.responsible === assignedUser;
    const inPeriod = (l: Lead) => {
      const d = l.enteredAt; // ISO yyyy-mm-dd
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
    const set = new Set<string>();
    COLUMNS.forEach(({ key }) => {
      const columnData = data[key] || []; // Fallback para array vazio se não existir
      columnData.forEach((l) => set.add(l.responsible));
    });
    return Array.from(set).sort();
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
    setOpen,
    selected,
    onDragOver,
    clearErrors,
    handleCardClick,
    handleCardMouseDown,
    handleCardDragStart,
    openNewLeadDialog,
    onDrop,
    onDragStart
  };
  
  return (
    <BoardContext.Provider value={value}>
      {children}
    </BoardContext.Provider>
  );
}

// Exportar constantes úteis
export { COLUMNS, formatDate };