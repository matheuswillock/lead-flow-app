"use client";

import { ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Plano no Corretor Studio</span>
        <span>Plano do seu arquivo</span>
      </div>

      <FieldGroup className="gap-4">
        {distinctValues.map(({ value, count }) => (
          <Field key={value} orientation="responsive">
            <Select
              value={planMapping[value] || undefined}
              onValueChange={(next) => onPlanMappingChange(value, next)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {planOptions.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {plan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
