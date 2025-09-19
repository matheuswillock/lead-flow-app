import { createContext, ReactNode, useMemo, useState } from "react";
import { IBoardService } from "./services/IBoardServices";
import { createBoardService } from "./services/BoardService";

interface IBoardProviderProps {
  children: ReactNode;
  boardService?: IBoardService;
}

interface IBoardContextState {
  isLoading: boolean;
  query: string;
  data: Record<ColumnKey, Lead[]>;
  periodStart: string; 
  periodEnd: string;
  assignedUser: string; 
  errors: Record<string, string>;
  open: boolean;
  selected: Lead | null;
  clearErrors: () => void;
  handleCardClick: (lead: Lead) => void;
  handleCardMouseDown: () => void;
  handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
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

const BoardContext = createContext<IBoardContextState | undefined>(undefined);

export const BoardProvider: React.FC<IBoardProviderProps> = ({ 
  children, 
  boardService = createBoardService()
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Record<ColumnKey, Lead[]>>(() => ({} as Record<ColumnKey, Lead[]>));
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
    const next: Record<ColumnKey, Lead[]> = { ...data } as any;
    (Object.keys(next) as ColumnKey[]).forEach((key) => {
      next[key] = next[key].filter((l) => inQuery(l) && inResponsible(l) && inPeriod(l));
    });
    return next;
  }, [data, query, assignedUser, periodStart, periodEnd]);

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    (Object.keys(data) as ColumnKey[]).forEach((k) => {
      data[k].forEach((l) => set.add(l.responsible));
    });
    return Array.from(set).sort();
  }, [data]);

  const value: IBoardContextState = {
    isLoading,
    query,
    data,
    periodStart,
    periodEnd,
    assignedUser,
    errors,
    open,
    selected,
    onDragOver,
    clearErrors,
    handleCardClick,
    handleCardMouseDown,
    handleCardDragStart,
    onDrop,
    onDragStart
  };



  
  return (
    <BoardContext.Provider value={value}>
      {children}
    </BoardContext.Provider>
  );
}