"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileIcon, Image as ImageIcon, File as FileTextIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "./input";

export interface Attachment {
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
  initialAttachments?: Attachment[];
  /** Supabase user ID — enviado como x-supabase-user-id nas requisições. */
  supabaseId?: string;
  /** Team ID ativo — enviado como x-team-id nas requisições. */
  teamId?: string;
}

const ATTACHMENTS_CACHE_TTL_MS = 60 * 1000;
const attachmentsCacheByLeadId = new Map<string, { attachments: Attachment[]; timestamp: number }>();
const attachmentsInFlightByLeadId = new Map<string, Promise<Attachment[]>>();

function writeAttachmentsCache(leadId: string, attachments: Attachment[]) {
  attachmentsCacheByLeadId.set(leadId, { attachments, timestamp: Date.now() });
}

async function loadAttachmentsWithDedupe(leadId: string, force = false, headers?: Record<string, string>): Promise<Attachment[]> {
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

  const requestPromise = (async (): Promise<Attachment[]> => {
    const response = await fetch(`/api/v1/leads/${leadId}/attachments`, {
      headers: headers ?? {},
    });
    const result = await response.json();
    const nextAttachments = result.isValid && Array.isArray(result.result)
      ? (result.result as Attachment[])
      : [];
    writeAttachmentsCache(leadId, nextAttachments);
    return nextAttachments;
  })();

  attachmentsInFlightByLeadId.set(
    leadId,
    requestPromise.finally(() => {
      attachmentsInFlightByLeadId.delete(leadId);
    }),
  );

  return await requestPromise;
}

export function AttachmentList({ leadId, leadName, className, onUploadStateChange, onLoadingChange, initialAttachments, supabaseId, teamId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments ?? []);
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

  const fetchAttachments = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const nextAttachments = await loadAttachmentsWithDedupe(leadId, force, authHeaders);
      setAttachments(nextAttachments);
    } catch (error) {
      console.error("Erro ao buscar attachments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [leadId, authHeaders]);

  // Buscar attachments ao montar o componente.
  // Se initialAttachments foi fornecido, pula o fetch inicial e atualiza
  // o cache para que uploads/deletes subsequentes partam do estado correto.
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

      // Atualizar lista após uploads
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
      return <ImageIcon className="h-4 w-4" />;
    }
    if (fileType === "application/pdf") {
      return <FileTextIcon className="h-4 w-4 text-red-500" />;
    }
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 && !isUploading ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
          Nenhum arquivo anexado
        </div>
      ) : (
        <div className="space-y-2">
          {isUploading && (
            <div className="flex items-center gap-3 p-3 border border-dashed rounded-md animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Enviando arquivo...</span>
            </div>
          )}
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-1">{getFileIcon(attachment.fileType)}</div>
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {attachment.fileName}
                  </a>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatFileSize(attachment.fileSize)} • {attachment.uploader.fullName} •{" "}
                    {format(new Date(attachment.uploadedAt), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => handleDeleteAttachment(attachment.id)}
                className="shrink-0 ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
