"use client";

import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TemplateHistoryItem } from "../context/TemplateEditorTypes";

const HISTORY_LABELS: Record<string, string> = {
  created: "Criado",
  draft_saved: "Rascunho salvo",
  submitted_for_approval: "Enviado para aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  published: "Publicado",
  unpublished: "Despublicado",
  version_created: "Nova versão",
};

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

interface TemplateHistoryPanelProps {
  history: TemplateHistoryItem[];
  embedded?: boolean;
}

export function TemplateHistoryPanel({ history, embedded = false }: TemplateHistoryPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      {!embedded ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Histórico</h2>
          </div>
          <Badge variant="outline">{history.length}</Badge>
        </div>
      ) : null}
      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
      ) : (
        <div className="flex max-h-[min(24rem,50vh)] flex-col gap-3 overflow-y-auto pr-1">
          {history.map((item) => {
            const actor = item.actor?.fullName?.trim() || item.actor?.email || "Sistema";
            return (
              <div key={item.id} className="flex flex-col gap-1 border-l pl-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {HISTORY_LABELS[item.eventType] ?? item.eventType}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatHistoryDate(item.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.description || "Sem descrição"}</p>
                <p className="text-[10px] text-muted-foreground">Por {actor}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
