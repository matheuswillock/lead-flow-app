"use client";

import { AgeEntryInput } from "@/components/ui/age-entry-input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadAgeFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadAgeField<T extends FieldValues>({
  control,
  disabled,
}: LeadAgeFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"age" as Path<T>}
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel className="mb-1 block text-sm font-medium">
            Idades dos Beneficiários
          </FormLabel>
          <FormControl>
            <AgeEntryInput
              value={String(field.value || "")}
              onChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
