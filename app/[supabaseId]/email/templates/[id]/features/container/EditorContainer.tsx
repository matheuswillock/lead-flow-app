"use client";

import { useRef } from "react";
import { AlertCircle, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import { EmailEditorStudio, type EmailEditorStudioRef } from "../components/EmailEditorStudio";

export function EditorContainer() {
  const {
    draft,
    error,
    loading,
    saving,
    updateDraft,
  } = useTemplateEditorContext();
  const editorRef = useRef<EmailEditorStudioRef>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-full max-w-3xl" />
        <Skeleton className="h-32 w-full max-w-3xl" />
        <Skeleton className="min-h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Editor de template</h1>
          <p className="text-sm text-muted-foreground">
            Configure os metadados e o conteúdo visual do e-mail.
          </p>
        </div>
        <Button onClick={() => void editorRef.current?.publish()} disabled={saving}>
          {saving ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
          {saving ? "Publicando..." : "Publicar"}
        </Button>
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

      <EmailEditorStudio ref={editorRef} />
    </div>
  )
}
