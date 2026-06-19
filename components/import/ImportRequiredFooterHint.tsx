"use client";

import { Check } from "lucide-react";

interface ImportRequiredFooterHintProps {
  pendingCount: number;
}

export function ImportRequiredFooterHint({ pendingCount }: ImportRequiredFooterHintProps) {
  if (pendingCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-semantic-success">
        <Check className="size-3.5" />
        Campos obrigatórios prontos
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      <b className="font-semibold text-foreground/80">{pendingCount}</b>{" "}
      {pendingCount === 1 ? "campo obrigatório pendente" : "campos obrigatórios pendentes"}
    </span>
  );
}
