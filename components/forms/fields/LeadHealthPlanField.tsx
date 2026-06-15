"use client";

import { useMemo } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Control, FieldValues, Path, useWatch } from "react-hook-form";

interface HealthPlanOption {
  id: string;
  name: string;
  iconUrl?: string | null;
}

interface LeadHealthPlanFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  options: HealthPlanOption[];
  loading?: boolean;
}

export function LeadHealthPlanField<T extends FieldValues>({
  control,
  disabled,
  options,
  loading = false,
}: LeadHealthPlanFieldProps<T>) {
  const currentValue = useWatch({
    control,
    name: "currentHealthPlan" as Path<T>,
  });

  const mergedOptions = useMemo(() => {
    const baseNames = options.map((option) => option.name.trim()).filter(Boolean);
    const extraValue = typeof currentValue === "string" ? currentValue.trim() : "";

    if (!extraValue || baseNames.includes(extraValue)) {
      return options;
    }

    return [
      ...options,
      { id: `current-health-plan-${extraValue}`, name: extraValue, iconUrl: null },
    ];
  }, [currentValue, options]);

  return (
    <FormField
      control={control}
      name={"currentHealthPlan" as Path<T>}
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel className="mb-1 block text-sm font-medium">
            Qual o plano de saúde?
          </FormLabel>
          <FormControl>
            <Select
              value={String(field.value || "")}
              onValueChange={field.onChange}
              disabled={disabled || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano atual ou 'Nova Adesão' se não possui" />
              </SelectTrigger>
              <SelectContent>
                {mergedOptions.map((option) => (
                  <SelectItem key={option.id} value={option.name}>
                    <span className="flex items-center gap-2">
                      {option.iconUrl ? (
                        <img src={option.iconUrl} alt="" className="size-4 rounded object-cover" />
                      ) : null}
                      {option.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
