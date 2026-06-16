"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { maskPhone, normalizeLeadPhoneDigits } from "@/lib/masks";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadPhoneFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
}

export function LeadPhoneField<T extends FieldValues>({
  control,
  disabled,
}: LeadPhoneFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={"phone" as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">Telefone*</FormLabel>
          <FormControl>
            <Input
              value={maskPhone(normalizeLeadPhoneDigits(String(field.value || "")))}
              onChange={(e) => {
                field.onChange(normalizeLeadPhoneDigits(e.target.value));
              }}
              type="tel"
              placeholder="(11) 91234-1234"
              required
              disabled={disabled}
              maxLength={20}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
