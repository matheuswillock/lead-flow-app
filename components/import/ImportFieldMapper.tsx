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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ImportMappingHeader } from "./ImportMappingHeader";
import { ImportSelect } from "./ImportSelect";
import type { ImportFieldDef } from "./types";

const SAMPLE_VALUES_LIMIT = 3;

export type ImportFieldMapping = Record<string, string>;

interface ImportFieldMapperProps {
  fields: ImportFieldDef[];
  columns: string[];
  rows: Record<string, string>[];
  mapping: ImportFieldMapping;
  onMappingChange: (fieldKey: string, column: string | undefined) => void;
  disabled?: boolean;
}

export function ImportFieldMapper({
  fields,
  columns,
  rows,
  mapping,
  onMappingChange,
  disabled,
}: ImportFieldMapperProps) {
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

  const usedColumns = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const columnOptions = useMemo(
    () => columns.map((column) => ({ value: column, label: column })),
    [columns]
  );

  return (
    <TooltipProvider delayDuration={0}>
      <ImportMappingHeader left="Campo do Corretor Studio" right="Coluna do seu arquivo" sticky />
      <FieldGroup className="gap-0 pt-1">
        {fields.map((field) => {
          const selectedColumn = mapping[field.key];
          const isMapped = Boolean(selectedColumn);
          const sampleValues = selectedColumn
            ? sampleValuesByColumn.get(selectedColumn) ?? []
            : [];

          return (
            <Field
              key={field.key}
              orientation="responsive"
              className={cn(
                "border-l-2 border-b border-b-border py-4 pl-3 transition-colors",
                isMapped ? "border-l-primary" : "border-l-transparent"
              )}
            >
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
                {isMapped && sampleValues.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Exemplos:{" "}
                    <span className="italic">
                      {sampleValues.map((value) => `"${value}"`).join(", ")}
                    </span>
                  </p>
                )}
              </FieldContent>
              <ImportSelect
                value={selectedColumn}
                options={columnOptions}
                placeholder="Ignorar este campo"
                ignoreLabel="Ignorar este campo"
                groupLabel="Colunas do arquivo"
                usedValues={usedColumns}
                onChange={(column) => onMappingChange(field.key, column)}
                disabled={disabled}
              />
            </Field>
          );
        })}
      </FieldGroup>
    </TooltipProvider>
  );
}
