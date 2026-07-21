"use client";

interface ImportProgressSummaryProps {
  mapped: number;
  total: number;
  /** Texto após a contagem, ex.: "campos mapeados". */
  label: string;
}

export function ImportProgressSummary({ mapped, total, label }: ImportProgressSummaryProps) {
  const percent = total > 0 ? Math.round((mapped / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border bg-surface-1 px-3.5 py-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/55 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="whitespace-nowrap text-xs text-muted-foreground">
        <b className="font-semibold text-foreground">{mapped}</b> de {total} {label}
      </p>
    </div>
  );
}
