"use client";

import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types";
import type { leadFormData } from "@/lib/validations/validationForms";
import type { UseFormReturn } from "react-hook-form";

type LeadFormWithCustomFields = leadFormData & {
  customFields?: Record<string, unknown>;
};

type LeadCustomFieldsSectionProps = {
  form: UseFormReturn<LeadFormWithCustomFields>;
  definitions: LeadCustomFieldDefinitionDTO[];
  readOnly?: boolean;
};

function formatCustomFieldDisplayValue(definition: LeadCustomFieldDefinitionDTO, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (definition.type === "boolean") {
    return value === true ? "Sim" : "Não";
  }
  if (definition.type === "multi_select" && Array.isArray(value)) {
    const options = definition.options ?? [];
    return value
      .map((item) => options.find((option) => option.value === item)?.label ?? String(item))
      .join(", ");
  }
  if (definition.type === "select") {
    const option = definition.options?.find((item) => item.value === value);
    return option?.label ?? String(value);
  }
  if (definition.type === "date" && typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("pt-BR");
  }
  return String(value);
}

export function LeadCustomFieldsSection({
  form,
  definitions,
  readOnly = false,
}: LeadCustomFieldsSectionProps) {
  const activeDefinitions = definitions
    .filter((definition) => definition.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (activeDefinitions.length === 0) {
    return null;
  }

  if (readOnly) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {activeDefinitions.map((definition) => {
          const value = form.getValues(`customFields.${definition.key}` as const);
          return (
            <div key={definition.id} className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{definition.label}</span>
              <span className="text-sm">{formatCustomFieldDisplayValue(definition, value)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {activeDefinitions.map((definition) => (
        <FormField
          key={definition.id}
          control={form.control}
          name={`customFields.${definition.key}` as `customFields.${string}`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {definition.label}
                {definition.isRequired ? <span className="text-destructive"> *</span> : null}
              </FormLabel>
              <FormControl>
                {definition.type === "text" ? (
                  <Input {...field} value={String(field.value ?? "")} />
                ) : definition.type === "number" ? (
                  <Input
                    type="number"
                    value={field.value === undefined || field.value === null ? "" : String(field.value)}
                    onChange={(event) => {
                      const next = event.target.value;
                      field.onChange(next === "" ? undefined : Number(next));
                    }}
                  />
                ) : definition.type === "date" ? (
                  <Input
                    type="date"
                    value={
                      typeof field.value === "string" && field.value
                        ? field.value.slice(0, 10)
                        : ""
                    }
                    onChange={(event) =>
                      field.onChange(
                        event.target.value
                          ? new Date(`${event.target.value}T12:00:00.000Z`).toISOString()
                          : undefined
                      )
                    }
                  />
                ) : definition.type === "select" ? (
                  <Select value={typeof field.value === "string" ? field.value : ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(definition.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : definition.type === "multi_select" ? (
                  <LeadsMultiFilter
                    title={definition.label}
                    options={(definition.options ?? []).map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    selectedValues={Array.isArray(field.value) ? field.value.map(String) : []}
                    onChange={field.onChange}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                    <span className="text-sm text-muted-foreground">
                      {field.value === true ? "Sim" : "Não"}
                    </span>
                  </div>
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
