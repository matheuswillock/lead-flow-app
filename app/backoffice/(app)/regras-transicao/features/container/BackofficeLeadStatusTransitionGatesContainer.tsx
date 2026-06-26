"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BackofficeLeadTransitionGateType, LeadStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GATE_TYPE_LABELS } from "@/lib/leadStatusTransitionGates";
import { leadStatusLabels } from "@/lib/lead-status";
import { toast } from "sonner";

const ALL_STATUSES = Object.keys(leadStatusLabels) as LeadStatus[];

type BackofficeGate = {
  id: string;
  slug: string;
  name: string;
  gateType: BackofficeLeadTransitionGateType;
  sourceStatus: LeadStatus | null;
  targetStatus: LeadStatus | null;
  config: Record<string, unknown>;
  blockerType: string;
  errorMessage: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

function readStatusArray(config: Record<string, unknown>, key: string): LeadStatus[] {
  const value = config[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LeadStatus => typeof item === "string");
}

function setStatusArray(
  config: Record<string, unknown>,
  key: string,
  values: LeadStatus[]
): Record<string, unknown> {
  return { ...config, [key]: values };
}

export function BackofficeLeadStatusTransitionGatesContainer() {
  const [gates, setGates] = useState<BackofficeGate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingGate, setEditingGate] = useState<BackofficeGate | null>(null);

  const loadGates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/backoffice/lead-status-transition-gates", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!data.isValid) {
        throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar gates");
      }
      setGates((data.result?.gates as BackofficeGate[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar gates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGates();
  }, [loadGates]);

  const configStatusKey = useMemo(() => {
    if (!editingGate) return null;
    switch (editingGate.gateType) {
      case "allowed_target_statuses":
        return "allowedTargetStatuses";
      case "block_targets_when_field_equals":
        return "blockedTargetStatuses";
      case "require_meeting_heald_on_exit":
        return "exemptTargetStatuses";
      case "require_sales_info":
      case "require_finalize_contract":
        return "targetStatuses";
      default:
        return null;
    }
  }, [editingGate]);

  const selectedStatuses = useMemo(() => {
    if (!editingGate || !configStatusKey) return [];
    return readStatusArray(editingGate.config, configStatusKey);
  }, [configStatusKey, editingGate]);

  const toggleStatusInConfig = (status: LeadStatus, checked: boolean) => {
    if (!editingGate || !configStatusKey) return;
    const current = readStatusArray(editingGate.config, configStatusKey);
    const next = checked
      ? current.includes(status)
        ? current
        : [...current, status]
      : current.filter((item) => item !== status);
    setEditingGate({
      ...editingGate,
      config: setStatusArray(editingGate.config, configStatusKey, next),
    });
  };

  const handleSave = async () => {
    if (!editingGate) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/v1/backoffice/lead-status-transition-gates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingGate.id,
          gate: {
            name: editingGate.name,
            gateType: editingGate.gateType,
            sourceStatus: editingGate.sourceStatus,
            targetStatus: editingGate.targetStatus,
            config: editingGate.config,
            blockerType: editingGate.blockerType,
            errorMessage: editingGate.errorMessage,
            isEnabled: editingGate.isEnabled,
            sortOrder: editingGate.sortOrder,
          },
        }),
      });
      const data = await response.json();
      if (!data.isValid) {
        throw new Error(data.errorMessages?.[0] ?? "Erro ao salvar gate");
      }
      toast.success("Gate salvo com sucesso.");
      setEditingGate(null);
      await loadGates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar gate");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Gates globais aplicados em todas as transições de status do CRM. Alterações entram em vigor
        imediatamente após salvar.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ordem</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gates.map((gate) => (
            <TableRow key={gate.id}>
              <TableCell>{gate.sortOrder}</TableCell>
              <TableCell>{gate.name}</TableCell>
              <TableCell>{GATE_TYPE_LABELS[gate.gateType]}</TableCell>
              <TableCell>
                {gate.sourceStatus ? leadStatusLabels[gate.sourceStatus] : "—"}
              </TableCell>
              <TableCell>
                {gate.targetStatus ? leadStatusLabels[gate.targetStatus] : "—"}
              </TableCell>
              <TableCell>{gate.isEnabled ? "Sim" : "Não"}</TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingGate(gate)}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editingGate} onOpenChange={(open) => !open && setEditingGate(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingGate?.name}</DialogTitle>
          </DialogHeader>
          {editingGate ? (
            <div className="overflow-y-auto flex-1">
              <FieldGroup className="gap-4 py-2">
                <Field>
                  <FieldLabel>Nome</FieldLabel>
                  <Input
                    value={editingGate.name}
                    onChange={(event) =>
                      setEditingGate({ ...editingGate, name: event.target.value })
                    }
                    disabled={isSaving}
                  />
                </Field>
                <Field>
                  <FieldLabel>Mensagem de erro</FieldLabel>
                  <Input
                    value={editingGate.errorMessage ?? ""}
                    onChange={(event) =>
                      setEditingGate({
                        ...editingGate,
                        errorMessage: event.target.value || null,
                      })
                    }
                    disabled={isSaving}
                  />
                </Field>
                <Field>
                  <FieldLabel>Ordem de execução</FieldLabel>
                  <Input
                    type="number"
                    value={editingGate.sortOrder}
                    onChange={(event) =>
                      setEditingGate({
                        ...editingGate,
                        sortOrder: Number(event.target.value) || 0,
                      })
                    }
                    disabled={isSaving}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editingGate.isEnabled}
                    onCheckedChange={(checked) =>
                      setEditingGate({ ...editingGate, isEnabled: checked })
                    }
                    disabled={isSaving}
                  />
                  <Label>Gate ativo</Label>
                </div>
                {configStatusKey ? (
                  <Field>
                    <FieldLabel>Status na configuração</FieldLabel>
                    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
                      {ALL_STATUSES.map((status) => (
                        <div key={status} className="flex items-center gap-3">
                          <Checkbox
                            id={`gate-status-${status}`}
                            checked={selectedStatuses.includes(status)}
                            onCheckedChange={(value) =>
                              toggleStatusInConfig(status, value === true)
                            }
                            disabled={isSaving}
                          />
                          <Label htmlFor={`gate-status-${status}`} className="font-normal">
                            {leadStatusLabels[status]}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </Field>
                ) : null}
              </FieldGroup>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingGate(null)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !editingGate}>
              {isSaving ? "Salvando..." : "Salvar gate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
