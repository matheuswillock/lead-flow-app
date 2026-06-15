"use client";

import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatDocumentInput, unmask } from "@/lib/masks";
import { Control, FieldValues, Path } from "react-hook-form";

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
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  return (
    <FormField
      control={control}
      name={"cnpj" as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">CNPJ</FormLabel>
          <FormControl>
            <Input
              value={formatDocumentInput(String(field.value || ""))}
              onChange={(e) => {
                const masked = formatDocumentInput(e.target.value);
                field.onChange(unmask(masked));
                if (duplicateError) {
                  setDuplicateError(null);
                }
              }}
              onBlur={async () => {
                field.onBlur();
                if (!onDuplicateCheck) return;

                const cnpj = String(field.value || "").trim();
                if (!cnpj) {
                  setDuplicateError(null);
                  return;
                }

                setChecking(true);
                try {
                  const error = await onDuplicateCheck(cnpj);
                  setDuplicateError(error);
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
          {duplicateError && (
            <p className="text-sm font-medium text-destructive">{duplicateError}</p>
          )}
          {checking && (
            <p className="text-sm text-muted-foreground">Verificando CNPJ...</p>
          )}
        </FormItem>
      )}
    />
  );
}
