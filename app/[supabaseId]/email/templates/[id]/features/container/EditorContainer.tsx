"use client";

import { useRef, useEffect } from "react";
import { AlertCircle, Code2, FileText, Save, Send, Undo2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import { EmailEditorStudio, type EmailEditorStudioRef } from "../components/EmailEditorStudio";
import { VariablesPanel } from "../components/VariablesPanel";
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext";

export function EditorContainer() {
  const {
    draft,
    template,
    error,
    loading,
    saving,
    updateDraft,
    unpublishTemplate,
  } = useTemplateEditorContext();
  const isPublished = template?.status === "published";
  const editorRef = useRef<EmailEditorStudioRef>(null);
  const { setOverride } = usePageBreadcrumb();

  useEffect(() => {
    if (loading) return;
    const label = !template ? "Novo template" : draft.name || "Novo template";
    setOverride({ label });
    return () => setOverride(null);
  }, [loading, template, draft.name, setOverride]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4 bg-background p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-full max-w-3xl" />
        <Skeleton className="h-32 w-full max-w-3xl" />
        <Skeleton className="min-h-0 flex-1 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Editor de template</h1>
            {template ? (
              isPublished ? (
                <Badge variant="outline" className="gap-1 border-semantic-success/30 bg-semantic-success/10 text-semantic-success">
                  <Send className="size-3" />
                  Publicado
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <FileText className="size-3" />
                  Rascunho
                </Badge>
              )
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Configure os metadados e o conteúdo visual do e-mail. Apenas templates publicados podem ser usados em campanhas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void editorRef.current?.openHtmlEditor()}
            disabled={saving}
          >
            <Code2 data-icon="inline-start" />
            HTML
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void editorRef.current?.publish()}
            disabled={saving}
          >
            {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            Salvar rascunho
          </Button>
          {isPublished ? (
            <Button type="button" variant="outline" onClick={() => void unpublishTemplate()} disabled={saving}>
              <Undo2 data-icon="inline-start" />
              Despublicar
            </Button>
          ) : (
            <Button onClick={() => void editorRef.current?.saveAndPublish()} disabled={saving}>
              {saving ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
              {saving ? "Publicando..." : "Publicar"}
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Erro no template</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          value={draft.name}
          onChange={(event) => updateDraft({ name: event.target.value })}
          placeholder="Nome do template"
          aria-label="Nome do template"
        />
        <Input
          value={draft.subject}
          onChange={(event) => updateDraft({ subject: event.target.value })}
          placeholder="Assunto do e-mail"
          aria-label="Assunto do e-mail"
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EmailEditorStudio ref={editorRef} />
        <div className="min-h-0 overflow-y-auto lg:max-h-full">
          <VariablesPanel />
        </div>
      </div>
    </div>
  )
}
