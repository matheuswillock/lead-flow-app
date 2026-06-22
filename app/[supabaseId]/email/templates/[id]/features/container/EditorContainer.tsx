"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CodeXml,
  Ellipsis,
  FileText,
  Mail,
  PencilLine,
  Save,
  Send,
  Undo2,
  X,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import { EmailEditorStudio, type EmailEditorStudioRef } from "../components/EmailEditorStudio";
import { TemplateTestDialog } from "../components/TemplateTestDialog";
import type { EditorMode } from "../components/EditorStudioTypes";
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext";

function StatusBadge({ approvalStatus, status }: { approvalStatus: string | undefined; status: string | undefined }) {
  if (approvalStatus === "approved" && status !== "published") {
    return (
      <Badge variant="outline" className="gap-1 border-semantic-success/30 bg-semantic-success/10 text-semantic-success">
        <Check className="size-3" />
        Template aprovado e pronto para publicar
      </Badge>
    );
  }
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
  const params = useParams<{ supabaseId: string; id: string }>();
  const {
    draft,
    template,
    error,
    loading,
    saving,
    templateApprovalRequired,
    activeRole,
    updateDraft,
    unpublishTemplate,
    submitForApproval,
    approveTemplate,
    rejectTemplate,
    sendTestTemplate,
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
  const [testOpen, setTestOpen] = useState(false);
  const [testHtml, setTestHtml] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("blocks");

  useEffect(() => {
    if (loading) return;
    const label = !template ? "Novo template" : draft.name || "Novo template";
    setOverride({ label });
    return () => setOverride(null);
  }, [loading, template, draft.name, setOverride]);

  const handleEditorModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
  }, []);

  const handleEditorModeToggle = useCallback((value: string) => {
    if (value !== "blocks" && value !== "html") return;
    const nextMode = value as EditorMode;
    if (nextMode === editorMode) return;
    editorRef.current?.requestModeSwitch(nextMode);
  }, [editorMode]);

  const handleConfirmReject = async () => {
    if (!reviewNote.trim()) return;
    await rejectTemplate(reviewNote.trim());
    setRejectOpen(false);
    setReviewNote("");
  };

  const handleOpenTestDialog = async () => {
    try {
      const snapshot = await editorRef.current?.getCurrentSnapshot();
      if (!snapshot?.html?.trim()) {
        toast.error("Não foi possível capturar o HTML atual do template.");
        return;
      }

      setTestHtml(snapshot.html);
      setTestOpen(true);
    } catch (error) {
      console.error("[EditorContainer][handleOpenTestDialog]", error);
      toast.error("Erro ao preparar o teste de envio.");
    }
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

  const showSubmitButton = templateApprovalRequired && !isPublished && !isPending && (isApproved || isRejected);
  const showApproveReject = isManager && isPending;
  const showPublish = !isPublished && isApproved && !isPending && (!templateApprovalRequired || Boolean(template?.approvedAt));
  const pendingVariableReviewCount = draft.variables.filter((variable) => variable.reviewStatus === "pending").length;
  const hasPendingVariableReview = pendingVariableReviewCount > 0;

  return (
    <>
      <div className="flex h-full max-h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-background p-6">
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
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider delayDuration={0}>
              <Tabs value={editorMode} onValueChange={handleEditorModeToggle}>
                <TabsList className="h-9">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value="blocks"
                        className="size-9 p-0"
                        aria-label="Blocos"
                        disabled={saving}
                      >
                        <PencilLine />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Blocos</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value="html"
                        className="size-9 p-0"
                        aria-label="HTML"
                        disabled={saving}
                      >
                        <CodeXml />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>HTML</TooltipContent>
                  </Tooltip>
                </TabsList>
              </Tabs>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={saving}
                  aria-label="Mais ações"
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleOpenTestDialog()} disabled={saving}>
                  <Mail data-icon="inline-start" />
                  Testar envio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <Button onClick={() => void editorRef.current?.saveAndPublish()} disabled={saving || hasPendingVariableReview}>
                {saving ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                {saving ? "Publicando..." : "Publicar"}
              </Button>
            ) : showSubmitButton ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving || hasPendingVariableReview}
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
        {hasPendingVariableReview ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>Variáveis pendentes de revisão</AlertTitle>
            <AlertDescription>
              Revise {pendingVariableReviewCount} variável(is) no painel lateral antes de enviar para aprovação ou publicar.
            </AlertDescription>
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

        <div className="min-h-0 flex-1 overflow-hidden">
          <EmailEditorStudio ref={editorRef} onModeChange={handleEditorModeChange} />
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

      <TemplateTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        supabaseId={typeof params.supabaseId === "string" ? params.supabaseId : ""}
        templateId={typeof params.id === "string" ? params.id : template?.id ?? ""}
        subject={draft.subject}
        html={testHtml}
        variables={draft.variables}
        sending={saving}
        onSend={sendTestTemplate}
      />
    </>
  );
}
