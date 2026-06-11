"use client";

import { ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Status no Corretor Studio</span>
        <span>Status do seu arquivo</span>
      </div>

      <FieldGroup className="gap-4">
        {distinctValues.map(({ value, count }) => (
          <Field key={value} orientation="responsive">
            <Select
              value={statusMapping[value] ?? "new_opportunity"}
              onValueChange={(next) =>
                onStatusMappingChange(value, next as LeadImportStatusKey)
              }
              disabled={disabled}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_IMPORT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <Badge variant="outline">{option.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
