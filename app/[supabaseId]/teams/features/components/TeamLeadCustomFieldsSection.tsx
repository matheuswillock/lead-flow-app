"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  LEAD_CUSTOM_FIELD_TYPE_LABELS,
  slugifyLeadCustomFieldKey,
  type LeadCustomFieldDefinitionDTO,
  type LeadCustomFieldOption,
} from "@/lib/leadCustomFields/types";
import type { LeadCustomFieldType } from "@prisma/client";
import { isManagerLikeRole } from "@/lib/roles";

type TeamLeadCustomFieldsSectionProps = {
  teamId: string;
  supabaseId: string;
  activeRole?: string | null;
  isMaster?: boolean;
};

type FieldDraft = {
  label: string;
  key: string;
  type: LeadCustomFieldType;
  options: LeadCustomFieldOption[];
  isRequired: boolean;
  showOnPublicForm: boolean;
};

const FIELD_TYPES: LeadCustomFieldType[] = [
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "boolean",
];

const emptyDraft = (): FieldDraft => ({
  label: "",
  key: "",
  type: "text",
  options: [{ value: "", label: "" }],
  isRequired: false,
  showOnPublicForm: false,
});

export function TeamLeadCustomFieldsSection({
  teamId,
  supabaseId,
  activeRole,
  isMaster = false,
}: TeamLeadCustomFieldsSectionProps) {
  const canManage = isMaster || isManagerLikeRole(activeRole ?? "");
  const [definitions, setDefinitions] = useState<LeadCustomFieldDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadCustomFieldDefinitionDTO | null>(null);
  const [editingDefinition, setEditingDefinition] = useState<LeadCustomFieldDefinitionDTO | null>(null);
  const [draft, setDraft] = useState<FieldDraft>(emptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lockKey, setLockKey] = useState(false);

  const sortedDefinitions = useMemo(
    () => [...definitions].sort((a, b) => a.displayOrder - b.displayOrder),
    [definitions]
  );

  const loadDefinitions = useCallback(async () => {
    if (!teamId || !supabaseId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/lead-custom-fields?includeInactive=true`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.isValid) {
        throw new Error(payload?.errorMessages?.[0] || "Erro ao carregar campos personalizados");
      }
      setDefinitions(Array.isArray(payload.result) ? payload.result : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar campos personalizados");
    } finally {
      setLoading(false);
    }
  }, [teamId, supabaseId]);

  useEffect(() => {
    if (canManage) {
      void loadDefinitions();
    }
  }, [canManage, loadDefinitions]);

  const openCreateDialog = () => {
    setEditingDefinition(null);
    setDraft(emptyDraft());
    setLockKey(false);
    setDialogOpen(true);
  };

  const openEditDialog = (definition: LeadCustomFieldDefinitionDTO) => {
    setEditingDefinition(definition);
    setDraft({
      label: definition.label,
      key: definition.key,
      type: definition.type,
      options: definition.options?.length ? definition.options : [{ value: "", label: "" }],
      isRequired: definition.isRequired,
      showOnPublicForm: definition.showOnPublicForm,
    });
    setLockKey(true);
    setDialogOpen(true);
  };

  const handleSaveDefinition = async () => {
    if (!draft.label.trim()) {
      toast.error("Informe o rótulo do campo");
      return;
    }
    if ((draft.type === "select" || draft.type === "multi_select") &&
      draft.options.filter((option) => option.value.trim() && option.label.trim()).length === 0) {
      toast.error("Adicione ao menos uma opção válida");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        label: draft.label.trim(),
        ...(lockKey ? {} : { key: slugifyLeadCustomFieldKey(draft.label) }),
        type: draft.type,
        isRequired: draft.isRequired,
        showOnPublicForm: draft.showOnPublicForm,
        options:
          draft.type === "select" || draft.type === "multi_select"
            ? draft.options
                .filter((option) => option.value.trim() && option.label.trim())
                .map((option) => ({
                  value: slugifyLeadCustomFieldKey(option.label) || option.value.trim(),
                  label: option.label.trim(),
                }))
            : undefined,
      };

      const response = await fetch(
        editingDefinition
          ? `/api/v1/teams/${teamId}/lead-custom-fields/${editingDefinition.id}`
          : `/api/v1/teams/${teamId}/lead-custom-fields`,
        {
          method: editingDefinition ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": teamId,
          },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao salvar campo");
      }

      toast.success(editingDefinition ? "Campo atualizado" : "Campo criado");
      setDialogOpen(false);
      await loadDefinitions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar campo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDefinition = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/lead-custom-fields/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao remover campo");
      }
      toast.success(result.successMessages?.[0] || "Campo removido");
      setDeleteTarget(null);
      await loadDefinitions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover campo");
    } finally {
      setIsDeleting(false);
    }
  };

  const reorderDefinition = async (definition: LeadCustomFieldDefinitionDTO, direction: "up" | "down") => {
    const index = sortedDefinitions.findIndex((item) => item.id === definition.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedDefinitions.length) return;

    const current = sortedDefinitions[index];
    const swapWith = sortedDefinitions[swapIndex];
    setIsSaving(true);
    try {
      await Promise.all([
        fetch(`/api/v1/teams/${teamId}/lead-custom-fields/${current.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": teamId,
          },
          body: JSON.stringify({ displayOrder: swapWith.displayOrder }),
        }),
        fetch(`/api/v1/teams/${teamId}/lead-custom-fields/${swapWith.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": teamId,
          },
          body: JSON.stringify({ displayOrder: current.displayOrder }),
        }),
      ]);
      await loadDefinitions();
    } catch {
      toast.error("Erro ao reordenar campos");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">Campos personalizados</h3>
          <p className="text-sm text-muted-foreground">
            Defina campos adicionais exibidos no formulário de leads deste time. Marque
            &quot;Exibir no formulário público&quot; para campos que devem aparecer em
            /lead-form. Leads de outros times da conta não exibirão estes campos.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreateDialog} disabled={loading || isSaving}>
          <Plus data-icon="inline-start" />
          Novo campo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando campos...</p>
      ) : sortedDefinitions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/70 px-6 py-10 text-center">
          <ListPlus className="size-8 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Nenhum campo personalizado</p>
            <p className="text-sm text-muted-foreground">
              Crie campos extras para capturar informações específicas do time.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={openCreateDialog}>
            Criar primeiro campo
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rótulo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead>Formulário público</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDefinitions.map((definition, index) => (
              <TableRow key={definition.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{definition.label}</span>
                    <span className="text-xs text-muted-foreground">{definition.key}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{LEAD_CUSTOM_FIELD_TYPE_LABELS[definition.type]}</Badge>
                </TableCell>
                <TableCell>{definition.isRequired ? "Sim" : "Não"}</TableCell>
                <TableCell>
                  <Badge variant={definition.showOnPublicForm ? "default" : "outline"}>
                    {definition.showOnPublicForm ? "Público" : "Interno"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={definition.isActive ? "default" : "outline"}>
                    {definition.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === 0 || isSaving}
                      onClick={() => void reorderDefinition(definition, "up")}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === sortedDefinitions.length - 1 || isSaving}
                      onClick={() => void reorderDefinition(definition, "down")}
                    >
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => openEditDialog(definition)}>
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setDeleteTarget(definition)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDefinition ? "Editar campo" : "Novo campo personalizado"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>Rótulo</FieldLabel>
                <Input
                  value={draft.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      label,
                      key: lockKey ? prev.key : slugifyLeadCustomFieldKey(label),
                    }));
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>Chave</FieldLabel>
                <Input
                  value={draft.key}
                  readOnly
                  disabled={lockKey || Boolean(editingDefinition)}
                />
              </Field>
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select
                  value={draft.type}
                  disabled={Boolean(editingDefinition)}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, type: value as LeadCustomFieldType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {LEAD_CUSTOM_FIELD_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {(draft.type === "select" || draft.type === "multi_select") && (
                <Field>
                  <FieldLabel>Opções</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {draft.options.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Rótulo"
                          value={option.label}
                          onChange={(event) => {
                            const next = [...draft.options];
                            next[index] = { ...next[index], label: event.target.value };
                            setDraft((prev) => ({ ...prev, options: next }));
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              options: prev.options.filter((_, optionIndex) => optionIndex !== index),
                            }))
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          options: [...prev.options, { value: "", label: "" }],
                        }))
                      }
                    >
                      Adicionar opção
                    </Button>
                  </div>
                </Field>
              )}
              <Field orientation="horizontal">
                <Switch
                  checked={draft.isRequired}
                  onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isRequired: checked }))}
                />
                <FieldLabel>Obrigatório</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  checked={draft.showOnPublicForm}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({ ...prev, showOnPublicForm: checked }))
                  }
                />
                <FieldLabel>Exibir no formulário público</FieldLabel>
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveDefinition()} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar campo personalizado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se o campo já tiver valores em leads, ele será desativado em vez de excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={() => void handleDeleteDefinition()}>
              {isDeleting ? "Removendo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
