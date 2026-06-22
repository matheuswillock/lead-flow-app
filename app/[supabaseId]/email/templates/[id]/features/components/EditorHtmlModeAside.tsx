"use client";

import { LayoutTemplate } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function EditorHtmlModeAside() {
  return (
    <aside className="h-full min-h-0 w-80 shrink-0 overflow-y-auto border-l bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Ajustes</h2>
        <Badge variant="secondary">HTML</Badge>
      </div>

      <Alert className="mt-4">
        <LayoutTemplate />
        <AlertTitle>Ajustes do documento</AlertTitle>
        <AlertDescription>
          Fundo, container, links e botões podem ser editados no modo blocos. Alterne para blocos no
          topo da página para ajustar o tema global do e-mail.
        </AlertDescription>
      </Alert>
    </aside>
  );
}
