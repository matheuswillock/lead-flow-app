"use client";

import { useState } from "react";
import { Clock3, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TemplateHistoryItem, TemplateVersionItem } from "../context/TemplateEditorTypes";

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

function displayName(profile: { fullName: string | null; email: string | null } | null | undefined) {
  return profile?.fullName?.trim() || profile?.email || "Sistema";
}

interface TemplateHistoryPanelProps {
  versions: TemplateVersionItem[];
  history: TemplateHistoryItem[];
  restoringVersionId: string | null;
  onRestoreVersion: (versionId: string) => Promise<void>;
  embedded?: boolean;
}

export function TemplateHistoryPanel({
  versions,
  history,
  restoringVersionId,
  onRestoreVersion,
  embedded = false,
}: TemplateHistoryPanelProps) {
  const [confirmVersionId, setConfirmVersionId] = useState<string | null>(null);

  const confirmVersion = versions.find((version) => version.id === confirmVersionId) ?? null;

  async function handleConfirmRestore() {
    if (!confirmVersionId) return;
    await onRestoreVersion(confirmVersionId);
    setConfirmVersionId(null);
  }

  return (
    <section className="flex flex-col gap-3">
      {!embedded ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Histórico</h2>
          </div>
          <Badge variant="outline">{versions.length}</Badge>
        </div>
      ) : null}

      {versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma versão publicada ainda.</p>
      ) : (
        <div className="flex max-h-[min(24rem,50vh)] flex-col gap-3 overflow-y-auto pr-1">
          {versions.map((version) => (
            <div key={version.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Versão {version.versionNumber}.0</span>
                <Badge variant="outline">{version.name}</Badge>
              </div>
              <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <p>
                  Publicado em:{" "}
                  {version.publishedAt ? formatHistoryDate(version.publishedAt) : "—"}
                </p>
                <p>Criador: {displayName(version.creator)}</p>
                <p>
                  Aprovado por: {displayName(version.approver)}
                  {version.approvedAt ? ` · ${formatHistoryDate(version.approvedAt)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={restoringVersionId === version.id}
                onClick={() => setConfirmVersionId(version.id)}
              >
                <RotateCcw data-icon="inline-start" />
                {restoringVersionId === version.id ? "Recuperando..." : "Recuperar HTML"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Eventos recentes</p>
          <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="flex flex-col gap-1 border-l pl-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {HISTORY_LABELS[item.eventType] ?? item.eventType}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatHistoryDate(item.createdAt)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Por {displayName(item.actor)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AlertDialog open={Boolean(confirmVersionId)} onOpenChange={(open) => !open && setConfirmVersionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar HTML da versão?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo da versão {confirmVersion?.versionNumber}.0 substituirá o HTML do rascunho
              atual. Alterações não salvas podem ser perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(restoringVersionId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmRestore()}
              disabled={Boolean(restoringVersionId)}
            >
              Recuperar HTML
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
