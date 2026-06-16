"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadOngoingTreatmentFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadOngoingTreatmentField<T extends FieldValues>({
  control,
  disabled,
}: LeadOngoingTreatmentFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"ongoingTreatment" as Path<T>}
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel className="mb-1 block text-sm font-medium">
            Existe algum tratamento em andamento?
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Descreva brevemente"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
