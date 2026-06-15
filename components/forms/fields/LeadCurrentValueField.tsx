"use client";

import { useEffect, useState } from "react";
import {
  formatCurrencyInput,
  MAX_CURRENCY_LABEL,
  MAX_CURRENCY_VALUE,
  parseCurrencyValue,
  toCurrencyStorageValue,
} from "@/lib/lead-form-utils";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Control,
  FieldValues,
  Path,
  UseFormClearErrors,
  UseFormSetError,
  UseFormSetValue,
  useWatch,
} from "react-hook-form";

interface LeadCurrentValueFieldProps<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  setValue: UseFormSetValue<T>;
  setError: UseFormSetError<T>;
  clearErrors: UseFormClearErrors<T>;
}

const formatCurrencyNumber = (value: number): string =>
  `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function LeadCurrentValueField<T extends FieldValues>({
  control,
  disabled,
  setValue,
  setError,
  clearErrors,
}: LeadCurrentValueFieldProps<T>) {
  const rawValue = useWatch({
    control,
    name: "currentValue" as Path<T>,
  });

  const [displayValue, setDisplayValue] = useState("");
  const [currentValueError, setCurrentValueError] = useState<string | null>(null);

  useEffect(() => {
    const raw = String(rawValue || "");
    if (!raw) {
      setDisplayValue("");
      setCurrentValueError(null);
      return;
    }

    const parsed = parseCurrencyValue(raw);
    if (parsed === null || Number.isNaN(parsed)) {
      setDisplayValue("");
      return;
    }

    setDisplayValue(formatCurrencyNumber(parsed));
    if (/[R$,]/.test(raw)) {
      const storage = toCurrencyStorageValue(raw);
      if (storage) {
        setValue("currentValue" as Path<T>, storage as T[Path<T>], {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    }
  }, [rawValue, setValue]);

  return (
    <FormField
      control={control}
      name={"currentValue" as Path<T>}
      render={() => (
        <FormItem>
          <FormLabel className="mb-1 block text-sm font-medium">Valor Atual</FormLabel>
          <FormControl>
            <Input
              value={displayValue}
              onChange={(e) => {
                const parsed = parseCurrencyValue(e.target.value);
                if (parsed !== null && parsed > MAX_CURRENCY_VALUE) {
                  const message = `Valor deve ser menor que ${MAX_CURRENCY_LABEL}`;
                  setCurrentValueError(message);
                  setError("currentValue" as Path<T>, { type: "manual", message });
                  return;
                }

                setCurrentValueError(null);
                clearErrors("currentValue" as Path<T>);

                const formatted = formatCurrencyInput(e.target.value);
                const storage = toCurrencyStorageValue(e.target.value);

                setDisplayValue(formatted);
                setValue("currentValue" as Path<T>, (storage ?? "") as T[Path<T>], {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              type="text"
              placeholder="R$ 10,00"
              disabled={disabled}
            />
          </FormControl>
          {currentValueError && <p className="text-xs text-destructive">{currentValueError}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
