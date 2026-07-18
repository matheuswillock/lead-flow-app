"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Attachment as AttachmentCard,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Upload, X, FileIcon, Image as ImageIcon, File as FileTextIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "./input";

export interface LeadAttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  uploader: {
    id: string;
    fullName: string;
    email: string;
  };
}

/** @deprecated Use LeadAttachmentItem — mantido para compatibilidade. */
export type Attachment = LeadAttachmentItem;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — espelha o backend
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

interface AttachmentListProps {
  leadId: string;
  leadName?: string;
  className?: string;
  onUploadStateChange?: (isUploading: boolean) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  /**
   * Quando fornecido, usa esses anexos como estado inicial e pula o fetch
   * de montagem. Útil quando o pai já carregou os dados via endpoint agregado.
   * O componente ainda fará re-fetch após uploads/deletes.
   */
  initialAttachments?: LeadAttachmentItem[];
  /** Supabase user ID — enviado como x-supabase-user-id nas requisições. */
  supabaseId?: string;
  /** Team ID ativo — enviado como x-team-id nas requisições. */
  teamId?: string;
}

const ATTACHMENTS_CACHE_TTL_MS = 60 * 1000;
const attachmentsCacheByLeadId = new Map<string, { attachments: LeadAttachmentItem[]; timestamp: number }>();
const attachmentsInFlightByLeadId = new Map<string, Promise<LeadAttachmentItem[]>>();

function writeAttachmentsCache(leadId: string, attachments: LeadAttachmentItem[]) {
  attachmentsCacheByLeadId.set(leadId, { attachments, timestamp: Date.now() });
}

async function loadAttachmentsWithDedupe(
  leadId: string,
  force = false,
  headers?: Record<string, string>
): Promise<LeadAttachmentItem[]> {
  if (!force) {
    const cached = attachmentsCacheByLeadId.get(leadId);
    if (cached && Date.now() - cached.timestamp <= ATTACHMENTS_CACHE_TTL_MS) {
      return cached.attachments;
    }
  }

  const existingRequest = attachmentsInFlightByLeadId.get(leadId);
  if (existingRequest) {
    return await existingRequest;
  }

  const requestPromise = (async (): Promise<LeadAttachmentItem[]> => {
    const response = await fetch(`/api/v1/leads/${leadId}/attachments`, {
      headers: headers ?? {},
    });
    const result = await response.json();
    const nextAttachments =
      result.isValid && Array.isArray(result.result)
        ? (result.result as LeadAttachmentItem[])
        : [];
    writeAttachmentsCache(leadId, nextAttachments);
    return nextAttachments;
  })();

  attachmentsInFlightByLeadId.set(
    leadId,
    requestPromise.finally(() => {
      attachmentsInFlightByLeadId.delete(leadId);
    })
  );

  return await requestPromise;
}

export function AttachmentList({
  leadId,
  leadName,
  className,
  onUploadStateChange,
  onLoadingChange,
  initialAttachments,
  supabaseId,
  teamId,
}: AttachmentListProps) {
  const [attachments, setAttachments] = useState<LeadAttachmentItem[]>(initialAttachments ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setUploadState = (value: boolean) => {
    setIsUploading(value);
    onUploadStateChange?.(value);
  };

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const authHeaders = React.useMemo(() => {
    const h: Record<string, string> = {};
    if (supabaseId) h["x-supabase-user-id"] = supabaseId;
    if (teamId) h["x-team-id"] = teamId;
    return Object.keys(h).length > 0 ? h : undefined;
  }, [supabaseId, teamId]);

  const fetchAttachments = useCallback(
    async (force = false) => {
      setIsLoading(true);
      try {
        const nextAttachments = await loadAttachmentsWithDedupe(leadId, force, authHeaders);
        setAttachments(nextAttachments);
      } catch (error) {
        console.error("Erro ao buscar attachments:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [leadId, authHeaders]
  );

  useEffect(() => {
    if (initialAttachments !== undefined) {
      setAttachments(initialAttachments);
      writeAttachmentsCache(leadId, initialAttachments);
      return;
    }

    let cancelled = false;

    const fetchInitialAttachments = async () => {
      setIsLoading(true);
      try {
        const nextAttachments = await loadAttachmentsWithDedupe(leadId, false, authHeaders);
        if (!cancelled) {
          setAttachments(nextAttachments);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao buscar attachments:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchInitialAttachments();
    return () => {
      cancelled = true;
    };
  }, [leadId, initialAttachments, authHeaders]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadState(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`Arquivo muito grande: ${file.name}`, {
            description: "Tamanho máximo permitido: 10MB",
          });
          continue;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`Tipo não permitido: ${file.name}`, {
            description: "Aceitos: imagens, PDF, Word, Excel e texto",
          });
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/v1/leads/${leadId}/attachments`, {
          method: "POST",
          headers: authHeaders ?? {},
          body: formData,
        });

        const result = await response.json();

        if (!result.isValid) {
          console.error(`Erro ao fazer upload de ${file.name}:`, result.errorMessages);
          toast.error(`Erro ao enviar ${file.name}`, {
            description: result.errorMessages.join(", "),
          });
        } else {
          const leadInfo = leadName ? ` no lead ${leadName}` : "";
          toast.success(`Arquivo salvo com sucesso${leadInfo}`, {
            description: file.name,
          });
        }
      }

      attachmentsCacheByLeadId.delete(leadId);
      await fetchAttachments(true);
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar arquivo", {
        description: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setUploadState(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/v1/leads/${leadId}/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: authHeaders ?? {},
      });

      const result = await response.json();

      if (result.isValid) {
        const deletedAttachment = attachments.find((att) => att.id === attachmentId);
        const nextAttachments = attachments.filter((att) => att.id !== attachmentId);
        setAttachments(nextAttachments);
        writeAttachmentsCache(leadId, nextAttachments);

        const leadInfo = leadName ? ` do lead ${leadName}` : "";
        toast.success(`Arquivo deletado com sucesso${leadInfo}`, {
          description: deletedAttachment?.fileName || "Arquivo removido",
        });
      } else {
        console.error("Erro ao deletar attachment:", result.errorMessages);
        toast.error("Erro ao deletar arquivo", {
          description: result.errorMessages.join(", "),
        });
      }
    } catch (error) {
      console.error("Erro ao deletar attachment:", error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <ImageIcon />;
    }
    if (fileType === "application/pdf") {
      return <FileTextIcon className="text-destructive" />;
    }
    return <FileIcon />;
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Arquivos Anexados</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleFileSelect}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Enviando...
            </>
          ) : (
            <>
              <Upload data-icon="inline-start" />
              Upload
            </>
          )}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 && !isUploading ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          Nenhum arquivo anexado
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {isUploading ? (
            <AttachmentCard state="uploading">
              <AttachmentMedia>
                <Loader2 className="animate-spin" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Enviando arquivo...</AttachmentTitle>
                <AttachmentDescription>Aguarde o upload terminar</AttachmentDescription>
              </AttachmentContent>
            </AttachmentCard>
          ) : null}
          {attachments.map((item) => {
            const isImage = item.fileType.startsWith("image/");
            return (
              <AttachmentCard key={item.id} state="done">
                <AttachmentMedia variant={isImage ? "image" : "icon"}>
                  {isImage ? (
                    <img src={item.fileUrl} alt={item.fileName} />
                  ) : (
                    getFileIcon(item.fileType)
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{item.fileName}</AttachmentTitle>
                  <AttachmentDescription>
                    {formatFileSize(item.fileSize)} · {item.uploader.fullName} ·{" "}
                    {format(new Date(item.uploadedAt), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remover ${item.fileName}`}
                    onClick={() => void handleDeleteAttachment(item.id)}
                  >
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
                <AttachmentTrigger asChild>
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${item.fileName}`}
                  />
                </AttachmentTrigger>
              </AttachmentCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
