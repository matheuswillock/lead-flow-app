"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_CLIENT_BASE } from "@/lib/route-map";
import { toastUserError } from "@/lib/ui/to-user-toast-message";

const MAX_DOCUMENT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 1000;

interface LeadDocumentRequestsDialogProps {
  open: boolean;
  leadId: string;
  teamId: string;
  supabaseId: string;
  onOpenChange: (open: boolean) => void;
  onRequestCreated: () => Promise<void>;
}

export function LeadDocumentRequestsDialog({
  open,
  leadId,
  teamId,
  supabaseId,
  onOpenChange,
  onRequestCreated,
}: LeadDocumentRequestsDialogProps) {
  const [documents, setDocuments] = useState<string[]>([""]);
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    }),
    [supabaseId, teamId]
  );

  const handleCreateRequest = async () => {
    if (isCreating) return;

    const cleanedDocuments = documents.map((document) => document.trim()).filter(Boolean);
    if (cleanedDocuments.length === 0) {
      toast.error("Adicione ao menos um documento");
      return;
    }
    if (cleanedDocuments.some((document) => document.length > MAX_DOCUMENT_LENGTH)) {
      toast.error(`Cada documento pode ter no máximo ${MAX_DOCUMENT_LENGTH} caracteres.`);
      return;
    }
    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      toast.error(`A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`);
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/document-requests`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          documents: cleanedDocuments,
          message: message.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok || data?.isValid === false) {
        throw new Error(data?.errorMessages?.[0] ?? "Falha ao criar solicitação");
      }

      toast.success("Solicitação criada e e-mail enviado");
      onOpenChange(false);
      setDocuments([""]);
      setMessage("");
      await onRequestCreated();
    } catch (error) {
      console.error("[LeadDocumentRequestsDialog] Erro ao criar:", error);
      toastUserError(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nova solicitação de documentos</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Documentos solicitados</FieldLabel>
              <FieldDescription>
                Cada documento pode ter até {MAX_DOCUMENT_LENGTH} caracteres.
              </FieldDescription>
              <div className="flex flex-col gap-2">
                {documents.map((doc, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Input
                        value={doc}
                        aria-invalid={doc.length > MAX_DOCUMENT_LENGTH}
                        aria-describedby={`document-${index}-error`}
                        onChange={(event) => {
                          const next = [...documents];
                          next[index] = event.target.value;
                          setDocuments(next);
                        }}
                        placeholder={`Documento ${index + 1}`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        {doc.length > MAX_DOCUMENT_LENGTH ? (
                          <FieldError id={`document-${index}-error`}>
                            O documento excede o limite de {MAX_DOCUMENT_LENGTH} caracteres.
                          </FieldError>
                        ) : (
                          <span />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {doc.length}/{MAX_DOCUMENT_LENGTH}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      disabled={documents.length === 1}
                      onClick={() =>
                        setDocuments(documents.filter((_, itemIndex) => itemIndex !== index))
                      }
                      aria-label="Remover documento"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDocuments([...documents, ""])}
                >
                  <Plus data-icon="inline-start" />
                  Adicionar documento
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="doc-request-message">Mensagem (opcional)</FieldLabel>
              <FieldDescription>
                A mensagem pode ter até {MAX_MESSAGE_LENGTH} caracteres.
              </FieldDescription>
              <Textarea
                id="doc-request-message"
                value={message}
                aria-invalid={message.length > MAX_MESSAGE_LENGTH}
                aria-describedby="doc-request-message-error"
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="Mensagem que o lead verá no e-mail e no formulário"
              />
              <div className="flex items-center justify-between gap-2">
                {message.length > MAX_MESSAGE_LENGTH ? (
                  <FieldError id="doc-request-message-error">
                    A mensagem excede o limite de {MAX_MESSAGE_LENGTH} caracteres.
                  </FieldError>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isCreating}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={isCreating} onClick={() => void handleCreateRequest()}>
            {isCreating ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Gerar link e enviar e-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
