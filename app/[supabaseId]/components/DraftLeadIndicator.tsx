"use client";

import { FilePen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DraftLeadIndicatorProps {
  showHint?: boolean;
  className?: string;
}

export function DraftLeadIndicator({ showHint = false, className }: DraftLeadIndicatorProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Badge variant="outline" aria-label="Lead em rascunho">
        <FilePen data-icon="inline-start" />
        Rascunho
      </Badge>
      {showHint ? (
        <p className="text-xs text-muted-foreground">Salve o lead para entrar no funil.</p>
      ) : null}
    </div>
  );
}
