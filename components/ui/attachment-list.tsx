"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileIcon, Image as ImageIcon, File as FileTextIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface AttachmentListProps {
  leadId: string;
  leadName?: string;
  className?: string;
}

export function AttachmentList({ leadId, leadName, className }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar attachments ao montar o componente
  useEffect(() => {
    fetchAttachments();
  }, [leadId]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/leads/${leadId}/attachments`);
      const result = await response.json();

      if (result.isValid && result.result) {
        setAttachments(result.result);
      }
    } catch (error) {
      console.error("Erro ao buscar attachments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      // Upload de múltiplos arquivos
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/v1/leads/${leadId}/attachments`, {
          method: "POST",
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
      await fetchAttachments();
    } catch (error) {
      console.error("Erro no upload:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/v1/leads/${leadId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.isValid) {
        const deletedAttachment = attachments.find((att) => att.id === attachmentId);
        setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
        
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
        <input
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
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
          Nenhum arquivo anexado
        </div>
      ) : (
        <div className="space-y-2">
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
                className="flex-shrink-0 ml-2"
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
