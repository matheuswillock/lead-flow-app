"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldValues, Path } from "react-hook-form";

interface LeadRazaoSocialFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  isLookupPending?: boolean;
}

export function LeadRazaoSocialField<T extends FieldValues>({
  control,
  disabled,
  isLookupPending,
}: LeadRazaoSocialFieldProps<T>) {
  const fieldName = "razaoSocial" as Path<T>;

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">Razão Social</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={String(field.value || "")}
              type="text"
              placeholder="Preenchido automaticamente ao informar CNPJ"
              disabled={disabled || isLookupPending}
              readOnly
            />
          </FormControl>
          {isLookupPending && (
            <p className="text-sm text-muted-foreground">Consultando razão social...</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
