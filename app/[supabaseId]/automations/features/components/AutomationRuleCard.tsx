"use client";

import type { ReactNode } from "react";
import { History, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AutomationRule } from "../context/AutomationsTypes";

/** Texto da mensagem enviada (WhatsApp ou e-mail); `null` quando a ação não manda mensagem. */
function messagePreviewOf(rule: AutomationRule): string | null {
  const config = rule.actionConfig;
  if (rule.actionType === "send_whatsapp_message") return String(config.messageTemplate ?? "");
  if (rule.actionType === "send_email") return String(config.emailSubject ?? config.emailBodyTemplate ?? "");
  return null;
}

/**
 * Card da automação: clicar no card abre a edição; ligar/desligar, execuções e excluir ficam à
 * vista (antes escondidos no menu "⋯").
 */
export function AutomationRuleCard({
  rule,
  icon,
  summary,
  actionLabel,
  disabled,
  onEdit,
  onToggle,
  onShowRuns,
  onDelete,
}: {
  rule: AutomationRule
  icon: ReactNode
  summary: string
  actionLabel: string
  disabled: boolean
  onEdit: () => void
  onToggle: (enabled: boolean) => void
  onShowRuns: () => void
  onDelete: () => void
}) {
  const stop = (action: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    action();
  };
  const messagePreview = messagePreviewOf(rule);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Editar automação ${rule.name}`}
      onClick={() => {
        if (!disabled) onEdit();
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget && !disabled) {
          event.preventDefault();
          onEdit();
        }
      }}
      className="flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-medium [overflow-wrap:anywhere]">{rule.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <Switch
          checked={rule.isEnabled}
          disabled={disabled}
          aria-label={rule.isEnabled ? `Desligar ${rule.name}` : `Ligar ${rule.name}`}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggle}
        />
      </div>
      {messagePreview ? (
        <p className="line-clamp-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {messagePreview}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary">{actionLabel}</Badge>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button size="sm" variant="outline" className="max-lg:min-h-11" disabled={disabled} onClick={stop(onEdit)}>
            <Pencil data-icon="inline-start" aria-hidden />
            {messagePreview !== null ? "Editar mensagem" : "Editar"}
          </Button>
          <Button size="sm" variant="ghost" className="max-lg:min-h-11" disabled={disabled} onClick={stop(onShowRuns)}>
            <History data-icon="inline-start" aria-hidden />
            Execuções
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11"
            disabled={disabled}
            onClick={stop(onDelete)}
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
