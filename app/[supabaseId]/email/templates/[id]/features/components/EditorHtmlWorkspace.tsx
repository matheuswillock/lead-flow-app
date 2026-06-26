"use client";

import { useMemo } from "react";
import { MonacoCodeEditor } from "@/components/editors/MonacoCodeEditor";
import { Badge } from "@/components/ui/badge";

function getFallbackPreviewHtml() {
  return '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:360px;color:#8a8a8a;font-family:sans-serif;font-size:14px;">Sem HTML para renderizar</div>';
}

interface EditorHtmlWorkspaceProps {
  value: string;
  onChange: (value: string) => void;
  remountKey?: string;
}

export function EditorHtmlWorkspace({ value, onChange, remountKey }: EditorHtmlWorkspaceProps) {
  const htmlPreviewContent = value.trim() ? value : getFallbackPreviewHtml();
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

  return (
    <div className="grid h-full min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Código HTML</h3>
            <p className="truncate text-xs text-muted-foreground">Fonte manual do template</p>
          </div>
          <Badge variant="secondary">HTML</Badge>
        </div>
        <div className="min-h-[360px] flex-1">
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
