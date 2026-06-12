"use client";

import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const IGNORE_VALUE = "__ignore__";

export interface ImportSelectOption {
  value: string;
  label: string;
}

interface ImportSelectProps {
  value: string | undefined;
  options: ImportSelectOption[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
  /** Adiciona a opção "Ignorar este campo" no topo (mapeamento de colunas). */
  ignoreLabel?: string;
  /** Rótulo do grupo de opções, ex.: "Colunas do arquivo". */
  groupLabel?: string;
  /** Valores já usados em outro campo — exibe a dica "· já usada". */
  usedValues?: Set<string>;
  disabled?: boolean;
}

export function ImportSelect({
  value,
  options,
  placeholder,
  onChange,
  ignoreLabel,
  groupLabel,
  usedValues,
  disabled,
}: ImportSelectProps) {
  const isMapped = Boolean(value);

  return (
    <Select
      value={value ?? (ignoreLabel ? IGNORE_VALUE : undefined)}
      onValueChange={(next) => onChange(next === IGNORE_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "w-full sm:w-58",
          isMapped && "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15"
        )}
      >
        {isMapped && <Check className="size-3.5 shrink-0 text-primary" />}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {ignoreLabel && (
          <>
            <SelectItem value={IGNORE_VALUE} className="text-muted-foreground">
              {ignoreLabel}
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        <SelectGroup>
          {groupLabel && <SelectLabel className="text-muted-foreground">{groupLabel}</SelectLabel>}
          {options.map((option) => {
            const usedElsewhere =
              usedValues?.has(option.value) && value !== option.value ? true : false;
            return (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                {usedElsewhere && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">· já usada</span>
                )}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
