"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadReferenceHospitalFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadReferenceHospitalField<T extends FieldValues>({
  control,
  disabled,
}: LeadReferenceHospitalFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"referenceHospital" as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">
            Hospital Referência (se houver)
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Digite o hospital"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
