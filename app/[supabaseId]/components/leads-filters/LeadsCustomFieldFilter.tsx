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
  type CustomFieldSortState,
} from "./customFieldFilterTypes";

const SORT_NONE_VALUE = "__none";

// "contains" usa Prisma `string_contains`, que exige que o valor JSON persistido
// seja uma string — number/boolean nunca casam, então o operador é omitido para
// esses tipos (multi_select tem tratamento próprio via array_contains no backend).
const OPERATORS_BY_TYPE: Record<LeadCustomFieldDefinitionDTO["type"], CustomFieldFilterOperator[]> = {
  text: ["eq", "neq", "contains", "is_empty", "not_empty"],
  date: ["eq", "neq", "contains", "is_empty", "not_empty"],
  select: ["eq", "neq", "contains", "is_empty", "not_empty"],
  multi_select: ["eq", "neq", "contains", "is_empty", "not_empty"],
  number: ["eq", "neq", "is_empty", "not_empty"],
  boolean: ["eq", "neq", "is_empty", "not_empty"],
};

function valueInputType(type: LeadCustomFieldDefinitionDTO["type"]): string {
  if (type === "number") return "number";
  if (type === "date") return "date";
  return "text";
}

interface LeadsCustomFieldFilterProps {
  definitions: LeadCustomFieldDefinitionDTO[];
  values: CustomFieldFilterState[];
  onChange: (values: CustomFieldFilterState[]) => void;
  sort: CustomFieldSortState | null;
  onSortChange: (sort: CustomFieldSortState | null) => void;
}

export function LeadsCustomFieldFilter({
  definitions,
  values,
  onChange,
  sort,
  onSortChange,
}: LeadsCustomFieldFilterProps) {
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
  const availableOperators = draftDefinition ? OPERATORS_BY_TYPE[draftDefinition.type] : [];
  const needsValue = draftOperator !== "is_empty" && draftOperator !== "not_empty";
  const isMultiSelectType = draftDefinition?.type === "multi_select";
  const isOptionType = draftDefinition?.type === "select" || isMultiSelectType;
  const isBooleanType = draftDefinition?.type === "boolean";

  // multi_select persiste um array JSON — o valor selecionado precisa ser
  // codificado como array para o backend testar pertencimento (array_contains)
  // em vez de comparar um escalar contra o array armazenado.
  const resolvedDraftValue: unknown = isMultiSelectType
    ? [draftOptionValue]
    : isOptionType
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
        <Button variant="outline" size="sm" className="h-8 max-lg:h-11 border-dashed">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Campos personalizados
          {(values.length > 0 || sort) && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {values.length + (sort ? 1 : 0)}
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
                      {availableOperators.map((operator) => (
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

            <Separator />

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Ordenar por</p>
              <Select
                value={sort?.definitionId ?? SORT_NONE_VALUE}
                onValueChange={(value) => {
                  if (value === SORT_NONE_VALUE) {
                    onSortChange(null);
                    return;
                  }
                  onSortChange({ definitionId: value, direction: sort?.direction ?? "asc" });
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SORT_NONE_VALUE}>Nenhum</SelectItem>
                  {definitions.map((def) => (
                    <SelectItem key={def.id} value={def.id}>
                      {def.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {sort && (
                <Select
                  value={sort.direction}
                  onValueChange={(value) => onSortChange({ ...sort, direction: value as "asc" | "desc" })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Crescente</SelectItem>
                    <SelectItem value="desc">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
