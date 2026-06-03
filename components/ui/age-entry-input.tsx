"use client";

import { X } from "lucide-react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deserializeAgeEntries,
  serializeAgeEntries,
  getTotalBeneficiariesFromEntries,
  type AgeEntry,
} from "@/lib/ageRanges";

export interface AgeEntryInputHandle {
  flush: () => string | null;
}

interface AgeEntryInputProps {
  value: string;
  onChange: (serialized: string) => void;
  disabled?: boolean;
  className?: string;
}

export const AgeEntryInput = forwardRef<AgeEntryInputHandle, AgeEntryInputProps>(
  function AgeEntryInput({ value, onChange, disabled = false, className }, ref) {
    const [inputAge, setInputAge] = useState("");
    const [inputCount, setInputCount] = useState("1");

    const entries = useMemo(() => deserializeAgeEntries(value), [value]);
    const total = useMemo(() => getTotalBeneficiariesFromEntries(entries), [entries]);

    const handleAdd = useCallback((): string | null => {
      const age = parseInt(inputAge, 10);
      const count = parseInt(inputCount, 10);
      if (isNaN(age) || age < 0 || age > 120) return null;
      if (isNaN(count) || count < 1) return null;

      const existing = entries.find((e) => e.age === age);
      let updated: AgeEntry[];
      if (existing) {
        updated = entries.map((e) =>
          e.age === age ? { ...e, count: e.count + count } : e
        );
      } else {
        updated = [...entries, { age, count }];
      }

      const serialized = serializeAgeEntries(updated);
      onChange(serialized);
      setInputAge("");
      setInputCount("1");
      return serialized;
    }, [inputAge, inputCount, entries, onChange]);

    useImperativeHandle(ref, () => ({
      flush: () => handleAdd(),
    }), [handleAdd]);

    const handleRemove = useCallback(
      (age: number) => {
        const updated = entries.filter((e) => e.age !== age);
        onChange(serializeAgeEntries(updated));
      },
      [entries, onChange]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAdd();
        }
      },
      [handleAdd]
    );

    const canAdd =
      !disabled &&
      inputAge.trim() !== "" &&
      !isNaN(parseInt(inputAge, 10)) &&
      parseInt(inputAge, 10) >= 0 &&
      parseInt(inputAge, 10) <= 120 &&
      parseInt(inputCount, 10) >= 1;

    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={120}
            placeholder="Idade"
            value={inputAge}
            onChange={(e) => setInputAge(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-24"
            aria-label="Idade do beneficiário"
          />
          <Input
            type="number"
            min={1}
            max={99}
            placeholder="Qtd"
            value={inputCount}
            onChange={(e) => setInputCount(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-20"
            aria-label="Quantidade de beneficiários"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canAdd}
            onClick={handleAdd}
          >
            + Adicionar
          </Button>
        </div>

        {entries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {entries
              .slice()
              .sort((a, b) => a.age - b.age)
              .map((entry) => (
                <Badge
                  key={entry.age}
                  variant="secondary"
                  className="flex items-center gap-1.5 pr-1.5"
                >
                  <span>
                    {entry.age} anos — {entry.count}{" "}
                    {entry.count === 1 ? "pessoa" : "pessoas"}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.age)}
                      className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
                      aria-label={`Remover ${entry.age} anos`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}
          </div>
        )}

        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            Total: {total} {total === 1 ? "beneficiário" : "beneficiários"}
          </p>
        )}
      </div>
    );
  }
);
