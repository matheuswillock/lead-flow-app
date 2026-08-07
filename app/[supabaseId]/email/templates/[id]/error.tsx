"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function TemplateEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 rounded-lg border bg-background p-6 text-center">
      <AlertTriangle className="size-8 text-warning" />
      <div>
        <p className="text-sm font-medium">Não foi possível carregar o editor de template</p>
        <p className="text-xs text-muted-foreground">
          Ocorreu um erro inesperado no editor. Tente recarregar.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={reset}>
        Recarregar editor
      </Button>
    </div>
  );
}
