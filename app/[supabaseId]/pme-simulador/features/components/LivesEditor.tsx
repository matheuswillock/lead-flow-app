"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGE_BAND_LABELS } from "../context/PlanSimulatorTypes";
import { formatVidas } from "./format";

type Props = {
  lives: number[];
  onChange: (index: number, value: number) => void;
};

/** Contador de vidas por faixa etária. Usado no assistente e na tela de resultados. */
export function LivesEditor({ lives, onChange }: Props) {
  const total = lives.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Quantas vidas em cada faixa etária</p>
        <span className="rounded-full border px-3 py-1 text-sm font-medium tabular-nums" aria-live="polite">
          {formatVidas(total)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {AGE_BAND_LABELS.map((label, index) => (
          <div key={label} className={`flex flex-col gap-2 rounded-xl border p-3 ${lives[index] > 0 ? "border-primary/40 bg-primary/5" : ""}`}>
            <span className="text-sm font-medium">{label}</span>
            <div className="flex items-center justify-between gap-1">
              <Button type="button" variant="outline" size="icon" aria-label={`Remover uma vida de ${label} anos`} disabled={lives[index] === 0} onClick={() => onChange(index, lives[index] - 1)}>
                <Minus className="size-4" />
              </Button>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Vidas de ${label} anos`}
                value={lives[index]}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                  onChange(index, digits === "" ? 0 : Number(digits));
                }}
                className="w-full min-w-0 bg-transparent text-center text-lg font-medium tabular-nums outline-none"
              />
              <Button type="button" variant="outline" size="icon" aria-label={`Adicionar uma vida de ${label} anos`} onClick={() => onChange(index, lives[index] + 1)}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
