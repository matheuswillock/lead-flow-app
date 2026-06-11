"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LEAD_IMPORT_FIELDS, type LeadImportFieldKey } from "@/lib/leadImport/leadImportFields";
import type { LeadImportMapping } from "./autoMapColumns";

const IGNORE_COLUMN_VALUE = "__ignore__";
const SAMPLE_VALUES_LIMIT = 3;

interface LeadFieldMapperProps {
  columns: string[];
  rows: Record<string, string>[];
  mapping: LeadImportMapping;
  onMappingChange: (field: LeadImportFieldKey, column: string | undefined) => void;
  disabled?: boolean;
}

export function LeadFieldMapper({
  columns,
  rows,
  mapping,
  onMappingChange,
  disabled,
}: LeadFieldMapperProps) {
  const sampleValuesByColumn = useMemo(() => {
    const samples = new Map<string, string[]>();
    columns.forEach((column) => {
      const values: string[] = [];
      for (const row of rows) {
        const value = row[column];
        if (value) values.push(value);
        if (values.length >= SAMPLE_VALUES_LIMIT) break;
      }
      samples.set(column, values);
    });
    return samples;
  }, [columns, rows]);

  return (
    <TooltipProvider delayDuration={0}>
      <FieldGroup className="gap-5">
        {LEAD_IMPORT_FIELDS.map((field) => {
          const selectedColumn = mapping[field.key];
          const sampleValues = selectedColumn ? sampleValuesByColumn.get(selectedColumn) ?? [] : [];

          return (
            <Field key={field.key} orientation="responsive">
              <FieldContent>
                <FieldTitle>
                  {field.label}
                  {field.required && <Badge variant="destructive">Obrigatório</Badge>}
                  {field.formatHint && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>{field.formatHint}</TooltipContent>
                    </Tooltip>
                  )}
                </FieldTitle>
                <FieldDescription>{field.description}</FieldDescription>
                {selectedColumn && sampleValues.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Exemplos:{" "}
                    <span className="italic">
                      {sampleValues.map((value) => `"${value}"`).join(", ")}
                    </span>
                  </p>
                )}
              </FieldContent>
              <Select
                value={selectedColumn ?? IGNORE_COLUMN_VALUE}
                onValueChange={(value) =>
                  onMappingChange(field.key, value === IGNORE_COLUMN_VALUE ? undefined : value)
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={IGNORE_COLUMN_VALUE}>Ignorar este campo</SelectItem>
                  {columns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          );
        })}
      </FieldGroup>
    </TooltipProvider>
  );
}
