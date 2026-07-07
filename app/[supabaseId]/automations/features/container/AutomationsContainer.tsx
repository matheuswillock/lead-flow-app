"use client";

import { useMemo, useState } from "react";
import { CalendarX, Clock, MoreHorizontal, Pencil, Trash2, Zap } from "lucide-react";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { useAutomationsContext } from "../context/AutomationsContext";
import type { AutomationRule } from "../context/AutomationsTypes";
import { AutomationRuleDialog } from "../components/AutomationRuleDialog";
import { AutomationRunsSheet } from "../components/AutomationRunsSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";

const TRIGGER_LABELS: Record<AutomationRule["triggerType"], string> = {
  lead_created: "Lead criado",
  status_changed: "Status alterado",
  lead_idle_in_status: "Lead parado no status",
  meeting_scheduled: "Reunião agendada",
  meeting_no_show: "No-show de reunião",
};

const ACTION_LABELS: Record<AutomationRule["actionType"], string> = {
  send_whatsapp_message: "WhatsApp",
  send_email: "E-mail",
  create_notification: "Notificação",
  assign_operator: "Atribuir operador",
};

const STATUS_LABELS: Record<string, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotação",
  future_sale: "Venda futura",
  offerNegotiation: "Negociação",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negócio fechado",
};

function summarizeTrigger(rule: AutomationRule) {
  const config = rule.triggerConfig as {
    targetStatus?: string;
    idleValue?: number;
    idleUnit?: string;
  };

  switch (rule.triggerType) {
    case "lead_created":
      return "Quando um lead for criado";
    case "status_changed":
      return `Quando o status mudar para ${STATUS_LABELS[config.targetStatus ?? ""] ?? config.targetStatus}`;
    case "lead_idle_in_status":
      return `Quando o lead ficar ${config.idleValue} ${config.idleUnit === "days" ? "dias" : "horas"} em ${STATUS_LABELS[config.targetStatus ?? ""] ?? config.targetStatus}`;
    case "meeting_scheduled":
      return "Quando uma reunião for agendada";
    case "meeting_no_show":
      return "Quando houver no-show de reunião";
    default:
      return TRIGGER_LABELS[rule.triggerType];
  }
}

function TriggerIcon({ triggerType }: { triggerType: AutomationRule["triggerType"] }) {
  if (triggerType === "lead_idle_in_status") return <Clock data-icon="inline-start" />;
  if (triggerType === "meeting_no_show") return <CalendarX data-icon="inline-start" />;
  return <Zap data-icon="inline-start" />;
}

export function AutomationsContainer() {
  const { hasAccess } = useFeatureAccess();
  const { rules, isLoading, error, mutationLock, toggleRule, deleteRule } = useAutomationsContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [runsRule, setRunsRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const canAccess = hasAccess(FEATURE_SLUGS.CRM_AUTOMATIONS);
  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled)),
    [rules]
  );

  if (!canAccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">Você não tem acesso a esta funcionalidade.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Automações</h1>
          <p className="text-sm text-muted-foreground">
            Configure gatilhos e ações automáticas para seus leads.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setDialogOpen(true);
          }}
          disabled={mutationLock}
        >
          Nova automação
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isLoading && !error && sortedRules.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <Zap className="size-10 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Nenhuma automação ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie sua primeira regra para automatizar ações nos leads.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingRule(null);
              setDialogOpen(true);
            }}
          >
            Nova automação
          </Button>
        </div>
      )}

      {!isLoading && !error && sortedRules.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedRules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TriggerIcon triggerType={rule.triggerType} />
                    <h2 className="font-medium">{rule.name}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{summarizeTrigger(rule)}</p>
                </div>
                <Switch
                  checked={rule.isEnabled}
                  disabled={mutationLock}
                  onCheckedChange={(checked) => void toggleRule(rule.id, checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{ACTION_LABELS[rule.actionType]}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" disabled={mutationLock}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingRule(rule);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil data-icon="inline-start" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRunsRule(rule)}>
                      Execuções
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <Trash2 data-icon="inline-start" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <AutomationRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
      />

      <AutomationRunsSheet rule={runsRule} onClose={() => setRunsRule(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra &quot;{deleteTarget?.name}&quot; será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              disabled={mutationLock}
              onClick={() => {
                if (!deleteTarget) return;
                void deleteRule(deleteTarget.id).then(() => setDeleteTarget(null));
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
