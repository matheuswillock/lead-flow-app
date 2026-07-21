"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types";
import { MAX_CUSTOM_FIELD_FILTERS, type CustomFieldFilterOperator } from "@/lib/leadCustomFields/customFieldQuery";
import {
  OPERATOR_LABELS,
  type CustomFieldFilterState,
} from "./customFieldFilterTypes";

const ALL_OPERATORS: CustomFieldFilterOperator[] = ["eq", "neq", "contains", "is_empty", "not_empty"];

function valueInputType(type: LeadCustomFieldDefinitionDTO["type"]): string {
  if (type === "number") return "number";
  if (type === "date") return "date";
  return "text";
}

interface LeadsCustomFieldFilterProps {
  definitions: LeadCustomFieldDefinitionDTO[];
  values: CustomFieldFilterState[];
  onChange: (values: CustomFieldFilterState[]) => void;
}

export function LeadsCustomFieldFilter({ definitions, values, onChange }: LeadsCustomFieldFilterProps) {
  const [draftDefinitionId, setDraftDefinitionId] = useState("");
  const [draftOperator, setDraftOperator] = useState<CustomFieldFilterOperator>("eq");
  const [draftValue, setDraftValue] = useState("");
  const [draftOptionValue, setDraftOptionValue] = useState("");

  const definitionById = useMemo(() => {
    const map = new Map<string, LeadCustomFieldDefinitionDTO>();
    for (const def of definitions) map.set(def.id, def);
    return map;
  }, [definitions]);

  const draftDefinition = draftDefinitionId ? definitionById.get(draftDefinitionId) : undefined;
  const needsValue = draftOperator !== "is_empty" && draftOperator !== "not_empty";
  const isOptionType = draftDefinition?.type === "select" || draftDefinition?.type === "multi_select";
  const isBooleanType = draftDefinition?.type === "boolean";

  const resolvedDraftValue: unknown = isOptionType
    ? draftOptionValue
    : isBooleanType
      ? draftOptionValue === "true"
      : draftDefinition?.type === "number"
        ? Number(draftValue)
        : draftValue;

  const hasValidValue = isOptionType || isBooleanType ? draftOptionValue !== "" : draftValue.trim() !== "";
  const atLimit = values.length >= MAX_CUSTOM_FIELD_FILTERS;
  const canAdd = Boolean(draftDefinitionId) && !atLimit && (!needsValue || hasValidValue);

  const resetDraft = () => {
    setDraftDefinitionId("");
    setDraftOperator("eq");
    setDraftValue("");
    setDraftOptionValue("");
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([
      ...values,
      {
        id: crypto.randomUUID(),
        definitionId: draftDefinitionId,
        operator: draftOperator,
        ...(needsValue && { value: resolvedDraftValue }),
      },
    ]);
    resetDraft();
  };

  const handleRemove = (id: string) => {
    onChange(values.filter((filter) => filter.id !== id));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Campos personalizados
          {values.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {values.length}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-4" align="start">
        {definitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum campo personalizado — crie na página do time.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {values.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {values.map((filter) => {
                    const def = definitionById.get(filter.definitionId);
                    const label = def?.label ?? "Campo removido";
                    return (
                      <Badge key={filter.id} variant="secondary" className="gap-1 pr-1 font-normal">
                        {label} {OPERATOR_LABELS[filter.operator]}
                        {filter.value !== undefined ? ` "${String(filter.value)}"` : ""}
                        <button
                          type="button"
                          onClick={() => handleRemove(filter.id)}
                          className="ml-1 rounded-sm hover:bg-muted"
                          aria-label={`Remover filtro de ${label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <Separator />
              </>
            )}

            <div className="flex flex-col gap-2">
              <Select
                value={draftDefinitionId}
                onValueChange={(value) => {
                  setDraftDefinitionId(value);
                  setDraftOperator("eq");
                  setDraftValue("");
                  setDraftOptionValue("");
                }}
                disabled={atLimit}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={atLimit ? `Máximo de ${MAX_CUSTOM_FIELD_FILTERS} filtros` : "Campo"} />
                </SelectTrigger>
                <SelectContent>
                  {definitions.map((def) => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {draftDefinitionId && (
                <>
                  <Select
                    value={draftOperator}
                    onValueChange={(value) => setDraftOperator(value as CustomFieldFilterOperator)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_OPERATORS.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {OPERATOR_LABELS[operator]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {needsValue && isOptionType && (
                    <Select value={draftOptionValue} onValueChange={setDraftOptionValue}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecione o valor" />
                      </SelectTrigger>
                      <SelectContent>
                        {(draftDefinition?.options ?? []).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {needsValue && isBooleanType && (
                    <Select value={draftOptionValue} onValueChange={setDraftOptionValue}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecione o valor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {needsValue && !isOptionType && !isBooleanType && (
                    <Input
                      className="h-8"
                      placeholder="Valor"
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                      type={valueInputType(draftDefinition?.type ?? "text")}
                    />
                  )}

                  <Button size="sm" className="h-8" disabled={!canAdd} onClick={handleAdd}>
                    Adicionar filtro
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
