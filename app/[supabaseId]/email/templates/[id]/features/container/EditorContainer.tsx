"use client";

import { useRef, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, Code2, FileText, Save, Send, Undo2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import { EmailEditorStudio, type EmailEditorStudioRef } from "../components/EmailEditorStudio";
import { VariablesPanel } from "../components/VariablesPanel";
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext";

function StatusBadge({ approvalStatus, status }: { approvalStatus: string | undefined; status: string | undefined }) {
  if (status === "published") {
    return (
      <Badge variant="outline" className="gap-1 border-semantic-success/30 bg-semantic-success/10 text-semantic-success">
        <Send className="size-3" />
        Publicado
      </Badge>
    );
  }
  if (approvalStatus === "pending_approval") {
    return (
      <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10 text-warning">
        <FileText className="size-3" />
        Aguardando aprovação
      </Badge>
    );
  }
  if (approvalStatus === "rejected") {
    return (
      <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/10 text-destructive">
        <X className="size-3" />
        Recusado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <FileText className="size-3" />
      Rascunho
    </Badge>
  );
}

export function EditorContainer() {
  const {
    draft,
    template,
    error,
    loading,
    saving,
    activeRole,
    updateDraft,
    unpublishTemplate,
    submitForApproval,
    approveTemplate,
    rejectTemplate,
  } = useTemplateEditorContext();

  const isPublished = template?.status === "published";
  const isPending = template?.approvalStatus === "pending_approval";
  const isApproved = template?.approvalStatus === "approved";
  const isRejected = template?.approvalStatus === "rejected";
  const isManager = activeRole === "manager";

  const editorRef = useRef<EmailEditorStudioRef>(null);
  const { setOverride } = usePageBreadcrumb();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    if (loading) return;
    const label = !template ? "Novo template" : draft.name || "Novo template";
    setOverride({ label });
    return () => setOverride(null);
  }, [loading, template, draft.name, setOverride]);

  const handleConfirmReject = async () => {
    if (!reviewNote.trim()) return;
    await rejectTemplate(reviewNote.trim());
    setRejectOpen(false);
    setReviewNote("");
  };

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

  const showSubmitButton = !isManager && !isPublished && !isPending && (isApproved === false || isRejected);
  const showApproveReject = isManager && isPending;
  const showPublish = !isPublished && isApproved && !isPending;

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-background p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Editor de template</h1>
              {template ? (
                <StatusBadge approvalStatus={template.approvalStatus} status={template.status} />
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
            ) : showApproveReject ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={saving}
                  onClick={() => setRejectOpen(true)}
                >
                  <X data-icon="inline-start" />
                  Recusar
                </Button>
                <Button
                  type="button"
                  className="bg-semantic-success text-white hover:bg-semantic-success/90"
                  disabled={saving}
                  onClick={() => void approveTemplate()}
                >
                  {saving ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                  Aprovar template
                </Button>
              </>
            ) : showPublish ? (
              <Button onClick={() => void editorRef.current?.saveAndPublish()} disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                {saving ? "Publicando..." : "Publicar"}
              </Button>
            ) : showSubmitButton ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void submitForApproval()}
              >
                {saving ? <Spinner data-icon="inline-start" /> : <ArrowRight data-icon="inline-start" />}
                {isRejected ? "Reenviar para aprovação" : "Enviar para aprovação"}
              </Button>
            ) : null}
          </div>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Erro no template</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {template?.approvalStatus === "rejected" && template.reviewNote ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Template recusado</AlertTitle>
            <AlertDescription>{template.reviewNote}</AlertDescription>
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

        <div className="min-h-0 flex-1">
          <EmailEditorStudio ref={editorRef} bottomSlot={<VariablesPanel />} />
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(open) => { setRejectOpen(open); if (!open) setReviewNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="editor-review-note">Motivo da recusa <span className="text-primary">*</span></Label>
            <Textarea
              id="editor-review-note"
              placeholder="Descreva o que precisa ser ajustado..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={500}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!reviewNote.trim() || saving}
              onClick={() => void handleConfirmReject()}
            >
              {saving ? <Spinner data-icon="inline-start" /> : null}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
