"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadAdditionalNotesFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadAdditionalNotesField<T extends FieldValues>({
  control,
  disabled,
}: LeadAdditionalNotesFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"additionalNotes" as Path<T>}
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel className="mb-1 block text-sm font-medium">Observações Adicionais</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder="Observações relevantes"
              disabled={disabled}
              rows={3}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
