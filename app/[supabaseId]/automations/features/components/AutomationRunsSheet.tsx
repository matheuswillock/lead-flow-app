"use client";

import { useEffect, useState } from "react";
import type { AutomationRule, AutomationRunLog } from "../context/AutomationsTypes";
import { useAutomationsContext } from "../context/AutomationsContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  rule: AutomationRule | null;
  onClose: () => void;
};

const STATUS_VARIANT: Record<AutomationRunLog["status"], "default" | "destructive" | "secondary"> = {
  success: "default",
  failed: "destructive",
  skipped: "secondary",
};

export function AutomationRunsSheet({ rule, onClose }: Props) {
  const { fetchRuns } = useAutomationsContext();
  const [runs, setRuns] = useState<AutomationRunLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!rule) return;
    setIsLoading(true);
    void fetchRuns(rule.id, page)
      .then((result) => {
        if (!result) return;
        setRuns(result.items);
        setTotalPages(result.totalPages);
      })
      .finally(() => setIsLoading(false));
  }, [rule, page, fetchRuns]);

  return (
    <Sheet open={!!rule} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Execuções — {rule?.name}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}

          {!isLoading && runs.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
          )}

          {!isLoading &&
            runs.map((run) => (
              <div key={run.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.executedAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {run.errorMessage && (
                  <p className="text-xs text-muted-foreground">{run.errorMessage}</p>
                )}
              </div>
            ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
