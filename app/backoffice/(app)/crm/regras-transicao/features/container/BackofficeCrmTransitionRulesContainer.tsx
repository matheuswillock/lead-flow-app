"use client";

import { useEffect, useMemo, useState } from "react";
import type { BackofficeLeadStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FIELD_CATALOG, type LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import { BACKOFFICE_CRM_STATUS_LABELS } from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes";
import { useBackofficeCrmTransitionRulesContext } from "../context/BackofficeCrmTransitionRulesContext";

const ALL_CRM_STATUSES = Object.keys(BACKOFFICE_CRM_STATUS_LABELS) as BackofficeLeadStatus[];

export function BackofficeCrmTransitionRulesContainer() {
  const { rules, availableFieldKeys, isLoading, isSaving, error, saveForTargetStatus } =
    useBackofficeCrmTransitionRulesContext();

  const [selectedStatus, setSelectedStatus] = useState<BackofficeLeadStatus>("new_opportunity");
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<LeadTransitionFieldKey[]>([]);

  const fieldKeys =
    availableFieldKeys.length > 0
      ? availableFieldKeys
      : (Object.keys(FIELD_CATALOG) as LeadTransitionFieldKey[]);

  const currentRuleFieldKeys = useMemo(() => {
    const rule = rules.find((item) => item.targetStatus === selectedStatus);
    return rule?.fieldKeys ?? [];
  }, [rules, selectedStatus]);

  useEffect(() => {
    setSelectedFieldKeys(currentRuleFieldKeys);
  }, [currentRuleFieldKeys, selectedStatus]);

  const toggleField = (fieldKey: LeadTransitionFieldKey, checked: boolean) => {
    setSelectedFieldKeys((prev) => {
      if (checked) {
        return prev.includes(fieldKey) ? prev : [...prev, fieldKey];
      }
      return prev.filter((key) => key !== fieldKey);
    });
  };

  const handleSave = async () => {
    await saveForTargetStatus(selectedStatus, selectedFieldKeys);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup className="max-w-xl">
        <Field>
          <FieldLabel>Status destino</FieldLabel>
          <Select
            value={selectedStatus}
            onValueChange={(value) => setSelectedStatus(value as BackofficeLeadStatus)}
            disabled={isSaving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_CRM_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {BACKOFFICE_CRM_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Campos obrigatórios</FieldLabel>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            {fieldKeys.map((fieldKey) => (
              <div key={fieldKey} className="flex items-center gap-3">
                <Checkbox
                  id={`crm-field-${fieldKey}`}
                  checked={selectedFieldKeys.includes(fieldKey)}
                  onCheckedChange={(value) => toggleField(fieldKey, value === true)}
                  disabled={isSaving}
                />
                <Label htmlFor={`crm-field-${fieldKey}`} className="font-normal">
                  {FIELD_CATALOG[fieldKey]?.label ?? fieldKey}
                </Label>
              </div>
            ))}
          </div>
        </Field>
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar regras"}
        </Button>
      </FieldGroup>
    </div>
  );
}
