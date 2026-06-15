"use client";

interface ImportMappingHeaderProps {
  left: string;
  right: string;
  /** Quando true, fixa o cabeçalho no topo da área rolável (mapeamento de campos). */
  sticky?: boolean;
}

export function ImportMappingHeader({ left, right, sticky }: ImportMappingHeaderProps) {
  return (
    <div
      className={
        sticky
          ? "sticky top-0 z-10 -mt-1 flex items-center justify-between gap-2 border-b border-border bg-background py-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          : "flex items-center justify-between gap-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
      }
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
