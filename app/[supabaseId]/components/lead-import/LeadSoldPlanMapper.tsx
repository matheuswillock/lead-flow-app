"use client";

import { ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { ImportMappingHeader } from "@/components/import/ImportMappingHeader";
import { ImportSelect } from "@/components/import/ImportSelect";

export interface LeadSoldPlanValueCount {
  value: string;
  count: number;
}

export type LeadSoldPlanMapping = Record<string, string>;

interface LeadSoldPlanMapperProps {
  distinctValues: LeadSoldPlanValueCount[];
  planOptions: string[];
  planMapping: LeadSoldPlanMapping;
  onPlanMappingChange: (fileValue: string, planName: string) => void;
  disabled?: boolean;
}

export function LeadSoldPlanMapper({
  distinctValues,
  planOptions,
  planMapping,
  onPlanMappingChange,
  disabled,
}: LeadSoldPlanMapperProps) {
  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <ArrowRight className="size-4" />
        <AlertDescription>
          Relacione cada plano vendido encontrado no seu arquivo com uma operadora cadastrada no
          Corretor Studio. Quando não houver correspondência, use &ldquo;Outros&rdquo;.
        </AlertDescription>
      </Alert>

      <ImportMappingHeader left="Plano no Corretor Studio" right="Plano do seu arquivo" />

      <FieldGroup className="gap-0">
        {distinctValues.map(({ value, count }) => (
          <Field
            key={value}
            orientation="responsive"
            className="border-l-2 border-l-primary border-b border-b-border py-4 pl-3"
          >
            <ImportSelect
              value={planMapping[value] || undefined}
              options={planOptions.map((plan) => ({ value: plan, label: plan }))}
              placeholder="Selecione o plano"
              onChange={(next) => next && onPlanMappingChange(value, next)}
              disabled={disabled}
            />
            <FieldContent className="@md/field-group:items-end @md/field-group:text-right">
              <FieldTitle>&ldquo;{value}&rdquo;</FieldTitle>
              <FieldDescription>
                {count} {count === 1 ? "linha usa este plano" : "linhas usam este plano"} no
                arquivo.
              </FieldDescription>
            </FieldContent>
          </Field>
        ))}
      </FieldGroup>
    </div>
  );
}
