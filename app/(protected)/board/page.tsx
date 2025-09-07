import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Filter, Plus } from "lucide-react";
import { motion } from "framer-motion";

// =============================
// Kanban de Leads – Mockup UI
// =============================
// Requisitos atendidos:
// - Colunas especificadas pelo usuário
// - Scroll horizontal quando não couber na tela
// - Cards com Nome do Lead e Data de entrada
// - Contador por coluna, busca, filtros por período e responsável
// - DnD simples (HTML5)
// - shadcn/ui + Tailwind; dark-mode friendly
// - Respeita o theme via CSS vars (usa tokens shadcn: background, card, border, etc.)

// Tipos

type Lead = {
  id: string;
  name: string;
  enteredAt: string; // ISO date (yyyy-mm-dd)
  responsible: string; // responsável pelo lead
};

type ColumnKey =
  | "nova_oportunidade"
  | "agendado"
  | "no_show"
  | "cotacao"
  | "negociacao"
  | "documentos_pendentes"
  | "proposta"
  | "dps_contrato"
  | "boleto"
  | "desqualificado"
  | "perdido"
  | "negado_operadora"
  | "negocio_fechado";

// Mapa de colunas (ordem do funil)
const COLUMNS: { key: ColumnKey; title: string }[] = [
  { key: "nova_oportunidade", title: "Nova oportunidade" },
  { key: "agendado", title: "Agendado" },
  { key: "no_show", title: "No Show" },
  { key: "cotacao", title: "cotação" },
  { key: "negociacao", title: "Negociação" },
  { key: "documentos_pendentes", title: "Documentos pendentes" },
  { key: "proposta", title: "proposta" },
  { key: "dps_contrato", title: "DPS | Contrato" },
  { key: "boleto", title: "BOLETO" },
  { key: "desqualificado", title: "Desqualoficado" },
  { key: "perdido", title: "perdido" },
  { key: "negado_operadora", title: "Negado operadora" },
  { key: "negocio_fechado", title: "negócio fechado" },
];

// Dados de exemplo (mock)
const seed: Record<ColumnKey, Lead[]> = {
  nova_oportunidade: [
    { id: "l1", name: "João da Silva", enteredAt: "2025-09-05", responsible: "Ana" },
    { id: "l2", name: "Maria Souza", enteredAt: "2025-09-06", responsible: "Bruno" },
  ],
  agendado: [
    { id: "l3", name: "Padaria do Centro", enteredAt: "2025-09-04", responsible: "Ana" },
  ],
  no_show: [
    { id: "l4", name: "Rest. Sabor & Arte", enteredAt: "2025-09-03", responsible: "Carla" },
  ],
  cotacao: [
    { id: "l5", name: "Churras House", enteredAt: "2025-09-02", responsible: "Bruno" },
  ],
  negociacao: [],
  documentos_pendentes: [],
  proposta: [
    { id: "l6", name: "Pizzaria da Praça", enteredAt: "2025-09-01", responsible: "Carla" },
  ],
  dps_contrato: [],
  boleto: [],
  desqualificado: [],
  perdido: [],
  negado_operadora: [],
  negocio_fechado: [
    { id: "l7", name: "Café Aurora", enteredAt: "2025-08-29", responsible: "Ana" },
  ],
};

function formatDate(iso: string) {
  try {
    const date = new Date(iso + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

export default function KanbanLeadsMock() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Record<ColumnKey, Lead[]>>(seed);
  const [periodStart, setPeriodStart] = useState<string>(""); // yyyy-mm-dd
  const [periodEnd, setPeriodEnd] = useState<string>(""); // yyyy-mm-dd
  const [responsavel, setResponsavel] = useState<string>("todos");

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    (Object.keys(data) as ColumnKey[]).forEach((k) => {
      data[k].forEach((l) => set.add(l.responsible));
    });
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inQuery = (l: Lead) => !q || l.name.toLowerCase().includes(q) || formatDate(l.enteredAt).includes(q);
    const inResponsible = (l: Lead) => responsavel === "todos" || l.responsible === responsavel;
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
  }, [data, query, responsavel, periodStart, periodEnd]);

  // Drag n' Drop – eventos básicos
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

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText className="size-5" />
        <h1 className="text-xl font-semibold">Kanban de Leads</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 opacity-70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou data (dd/mm/aaaa)"
              className="pl-8 w-64"
            />
          </div>

          {/* Filtro por período */}
          <div className="flex items-center gap-2">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">até</span>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-40" />
          </div>

          {/* Filtro por responsável */}
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="secondary">
            <Plus className="mr-1 size-4" /> Novo lead
          </Button>
        </div>
      </div>

      {/* Área de colunas com scroll horizontal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />

        <div
          className="grid auto-cols-[minmax(18rem,20rem)] grid-flow-col gap-4 overflow-x-auto pb-2 pr-2"
          style={{ scrollSnapType: "x proximity" }}
        >
          {COLUMNS.map(({ key, title }) => {
            const items = filtered[key];
            return (
              <motion.div
                key={key}
                className="col-span-1 flex min-h-[70vh] flex-col rounded-2xl border bg-card p-3 shadow-sm"
                drag={false}
                style={{ scrollSnapAlign: "start" }}
                onDrop={(e) => onDrop(e, key)}
                onDragOver={onDragOver}
              >
                {/* Cabeçalho da coluna */}
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium">{title}</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {items.length}
                  </Badge>
                </div>

                {/* Zona de cards */}
                <div className="flex flex-1 flex-col gap-2">
                  {items.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                      Solte aqui
                    </div>
                  )}

                  {items.map((lead) => (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, lead.id, key)}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="py-3">
                        <CardTitle className="text-base font-semibold leading-tight">
                          {lead.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3">
                        <div className="text-xs text-muted-foreground">
                          Entrada: {formatDate(lead.enteredAt)}
                        </div>
                        <div className="mt-1 text-xs">
                          <span className="text-muted-foreground">Resp.: </span>
                          {lead.responsible}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Rodapé simples */}
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        Dica: arraste os cards entre as colunas. Use a busca, período e responsável para filtrar.
      </div>
    </div>
  );
}
