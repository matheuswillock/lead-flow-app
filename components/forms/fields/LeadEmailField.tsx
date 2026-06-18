"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadEmailFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadEmailField<T extends FieldValues>({
  control,
  disabled,
}: LeadEmailFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"email" as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">E-mail</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="email"
              placeholder="email@exemplo.com"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
