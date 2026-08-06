"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentRequestItem } from "../context/DocumentRequestTypes";

interface DocumentItemCardProps {
  item: DocumentRequestItem;
  token: string;
  onUpload: (itemId: string, file: File) => Promise<boolean>;
}

export function DocumentItemCard({ item, onUpload }: DocumentItemCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isUploaded = Boolean(item.uploadedAt);

  const pickFile = (next: File | null) => {
    if (!next) return;
    setFile(next);
  };

  const upload = async () => {
    if (!file || isUploading || isUploaded) return;
    setIsUploading(true);
    try {
      const ok = await onUpload(item.id, file);
      if (ok) setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <article className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{item.name}</h3>
          {item.description ? (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        <Badge variant={isUploaded ? "default" : "outline"}>
          {isUploaded ? "Enviado" : "Aguardando"}
        </Badge>
      </div>

      {isUploaded ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm">
          <Check className="size-4 text-primary" />
          <span>
            Enviado em{" "}
            {new Date(item.uploadedAt!).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border/60 bg-muted/20 hover:bg-muted/40"
            )}
          >
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Arraste ou clique para selecionar
            </span>
            {file ? (
              <span className="text-xs font-medium text-foreground">{file.name}</span>
            ) : null}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            disabled={!file || isUploading}
            onClick={() => void upload()}
          >
            {isUploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Enviar
          </Button>
        </div>
      )}
    </article>
  );
}
