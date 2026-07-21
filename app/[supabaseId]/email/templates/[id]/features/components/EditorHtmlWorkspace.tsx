"use client";

import { useCallback, useMemo } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import { MonacoCodeEditor } from "@/components/editors/MonacoCodeEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { analyzeEmailHtml } from "../utils/analyze-email-html";

function getFallbackPreviewHtml() {
  return '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:360px;color:#8a8a8a;font-family:sans-serif;font-size:14px;">Sem HTML para renderizar</div>';
}

interface EditorHtmlWorkspaceProps {
  value: string;
  onChange: (value: string) => void;
  remountKey?: string;
  ready?: boolean;
}

export function EditorHtmlWorkspace({ value, onChange, remountKey, ready = true }: EditorHtmlWorkspaceProps) {
  const htmlPreviewContent = value.trim() ? value : getFallbackPreviewHtml();
  const htmlAlerts = useMemo(() => analyzeEmailHtml(value), [value]);
  const htmlEditorOptions = useMemo(
    () => ({
      formatOnPaste: true,
      formatOnType: true,
      minimap: { enabled: false },
      tabSize: 2,
      wordWrap: "on" as const,
    }),
    []
  );

  const handleCopyHtml = useCallback(async () => {
    if (!value.trim()) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success("HTML copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }, [value]);

  return (
    <div className="grid h-full min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Código HTML</h3>
            <p className="truncate text-xs text-muted-foreground">Fonte manual do template</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="secondary">HTML</Badge>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={!value.trim()}
                    onClick={() => void handleCopyHtml()}
                    aria-label="Copiar HTML"
                  >
                    <Copy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar HTML</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="min-h-[360px] flex-1">
          {ready ? (
            <MonacoCodeEditor
              editorKey={remountKey}
              value={value}
              onChange={onChange}
              language="html"
              height="100%"
              themeVariant="resend-dark"
              placeholder="Cole ou edite o HTML do e-mail..."
              options={htmlEditorOptions}
            />
          ) : (
            <Skeleton className="h-full w-full bg-[#05050A]" />
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Prévia do e-mail</h3>
            <p className="truncate text-xs text-muted-foreground">Atualizada em tempo real</p>
          </div>
          <Badge variant="outline">Preview</Badge>
        </div>
        {htmlAlerts.length > 0 ? (
          <Alert className="mx-3 mt-3 shrink-0 border-warning/30 bg-warning/10">
            <AlertTriangle data-icon="inline-start" className="text-warning" />
            <AlertDescription className="text-xs text-muted-foreground">
              A prévia usa um navegador completo; o e-mail real pode renderizar diferente.
              Consulte <strong className="font-medium text-foreground">Dicas</strong> no painel lateral.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="min-h-0 flex-1 bg-background">
          <iframe
            srcDoc={htmlPreviewContent}
            title="Prévia do HTML do e-mail"
            sandbox="allow-same-origin"
            className="h-full w-full border-0 bg-background"
          />
        </div>
      </section>
    </div>
  );
}
