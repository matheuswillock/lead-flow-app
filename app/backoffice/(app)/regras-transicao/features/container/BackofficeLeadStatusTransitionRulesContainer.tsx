"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeadStatus } from "@prisma/client";
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
import { leadStatusLabels } from "@/lib/lead-status";
import { useBackofficeLeadStatusTransitionRules } from "../context/BackofficeLeadStatusTransitionRulesContext";

const ALL_STATUSES = Object.keys(leadStatusLabels) as LeadStatus[];

export function BackofficeLeadStatusTransitionRulesContainer() {
  const { rules, availableFieldKeys, isLoading, isSaving, error, saveForTargetStatus } =
    useBackofficeLeadStatusTransitionRules();

  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>("pricingRequest");
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<LeadTransitionFieldKey[]>([]);

  const fieldKeys = availableFieldKeys.length > 0 ? availableFieldKeys : (Object.keys(FIELD_CATALOG) as LeadTransitionFieldKey[]);

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
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup className="max-w-xl">
        <Field>
          <FieldLabel>Status destino</FieldLabel>
          <Select
            value={selectedStatus}
            onValueChange={(value) => setSelectedStatus(value as LeadStatus)}
            disabled={isSaving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {leadStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Campos obrigatórios</FieldLabel>
          {selectedFieldKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum campo obrigatório para este status.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            {fieldKeys.map((fieldKey) => {
              const definition = FIELD_CATALOG[fieldKey];
              const checked = selectedFieldKeys.includes(fieldKey);
              return (
                <div key={fieldKey} className="flex items-center gap-3">
                  <Checkbox
                    id={`field-${fieldKey}`}
                    checked={checked}
                    onCheckedChange={(value) => toggleField(fieldKey, value === true)}
                    disabled={isSaving}
                  />
                  <Label htmlFor={`field-${fieldKey}`} className="font-normal">
                    {definition.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </Field>

        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar regras"}
        </Button>
      </FieldGroup>
    </div>
  );
}
