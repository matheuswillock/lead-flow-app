"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadNameFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadNameField<T extends FieldValues>({
  control,
  disabled,
}: LeadNameFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"name" as Path<T>}
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel className="mb-1 block text-sm font-medium">Nome Completo*</FormLabel>
          <FormControl>
            <Input
              {...field}
              required
              autoComplete="name"
              placeholder="Ex: Maria da Silva"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
