"use client";

import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatDocumentInput, unmask } from "@/lib/masks";
import { Control, FieldValues, Path, useFormContext } from "react-hook-form";

interface LeadCnpjFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  onDuplicateCheck?: (cnpj: string) => Promise<string | null>;
}

export function LeadCnpjField<T extends FieldValues>({
  control,
  disabled,
  onDuplicateCheck,
}: LeadCnpjFieldProps<T>) {
  const [checking, setChecking] = useState(false);
  const { clearErrors, setError } = useFormContext<T>();
  const fieldName = "cnpj" as Path<T>;

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">CNPJ</FormLabel>
          <FormControl>
            <Input
              value={formatDocumentInput(String(field.value || ""))}
              onChange={(e) => {
                const masked = formatDocumentInput(e.target.value);
                field.onChange(unmask(masked));
                clearErrors(fieldName);
              }}
              onBlur={async () => {
                field.onBlur();
                if (!onDuplicateCheck) return;

                const cnpj = String(field.value || "").trim();
                if (!cnpj) {
                  clearErrors(fieldName);
                  return;
                }

                setChecking(true);
                setError(fieldName, { type: "manual" });
                try {
                  const error = await onDuplicateCheck(cnpj);
                  if (error) {
                    setError(fieldName, { type: "manual", message: error });
                    return;
                  }

                  clearErrors(fieldName);
                } finally {
                  setChecking(false);
                }
              }}
              type="text"
              placeholder="00.000.000/0000-00"
              disabled={disabled || checking}
              maxLength={18}
            />
          </FormControl>
          <FormMessage />
          {checking && (
            <p className="text-sm text-muted-foreground">Verificando CNPJ...</p>
          )}
        </FormItem>
      )}
    />
  );
}
