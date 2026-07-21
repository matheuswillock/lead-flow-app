"use client";

import { ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { ImportMappingHeader } from "@/components/import/ImportMappingHeader";
import { ImportSelect } from "@/components/import/ImportSelect";
import {
  LEAD_IMPORT_STATUS_OPTIONS,
  type LeadImportStatusKey,
} from "@/lib/leadImport/leadImportStatus";

export interface LeadStatusValueCount {
  value: string;
  count: number;
}

export type LeadStatusMapping = Record<string, LeadImportStatusKey>;

interface LeadStatusMapperProps {
  distinctValues: LeadStatusValueCount[];
  statusMapping: LeadStatusMapping;
  onStatusMappingChange: (fileValue: string, status: LeadImportStatusKey) => void;
  disabled?: boolean;
}

export function LeadStatusMapper({
  distinctValues,
  statusMapping,
  onStatusMappingChange,
  disabled,
}: LeadStatusMapperProps) {
  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <ArrowRight className="size-4" />
        <AlertDescription>
          Relacione cada status encontrado no seu arquivo com um status do funil do Corretor
          Studio. Linhas sem status entram como Nova oportunidade.
        </AlertDescription>
      </Alert>

      <ImportMappingHeader left="Status no Corretor Studio" right="Status do seu arquivo" />

      <FieldGroup className="gap-0">
        {distinctValues.map(({ value, count }) => (
          <Field
            key={value}
            orientation="responsive"
            className="border-l-2 border-l-primary border-b border-b-border py-4 pl-3"
          >
            <ImportSelect
              value={statusMapping[value] ?? "new_opportunity"}
              options={LEAD_IMPORT_STATUS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              placeholder="Selecione o status"
              onChange={(next) => next && onStatusMappingChange(value, next as LeadImportStatusKey)}
              disabled={disabled}
            />
            <FieldContent className="@md/field-group:items-end @md/field-group:text-right">
              <FieldTitle>&ldquo;{value}&rdquo;</FieldTitle>
              <FieldDescription>
                {count} {count === 1 ? "linha usa este status" : "linhas usam este status"} no
                arquivo.
              </FieldDescription>
            </FieldContent>
          </Field>
        ))}
      </FieldGroup>
    </div>
  );
}
