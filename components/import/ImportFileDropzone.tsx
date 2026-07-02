"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const IMPORT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export interface ImportFileDropzoneConfig {
  accept: string;
  maxFileSizeBytes?: number;
  unsupportedFormatMessage: string;
  sizeLimitMessage?: string;
  subtitle: string;
  footerHint?: string;
  formatBadges?: ReactNode;
  validateFile?: (file: File) => string | null;
}

interface ImportFileDropzoneProps {
  config: ImportFileDropzoneConfig;
  onFileSelected: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  selectedFile?: File | null;
  onClearFile?: () => void;
  selectedFileLabel?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ImportFileDropzone({
  config,
  onFileSelected,
  onError,
  disabled,
  selectedFile,
  onClearFile,
  selectedFileLabel = "Arquivo selecionado",
}: ImportFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const maxFileSizeBytes = config.maxFileSizeBytes ?? IMPORT_FILE_MAX_SIZE_BYTES;
  const sizeLimitMessage =
    config.sizeLimitMessage ?? `O arquivo deve ter no máximo ${formatFileSize(maxFileSizeBytes)}`;

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;

    const customError = config.validateFile?.(file);
    if (customError) {
      onError(customError);
      return;
    }

    if (file.size > maxFileSizeBytes) {
      onError(sizeLimitMessage);
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  };

  if (selectedFile) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">{selectedFileLabel}</span>
            <span className="truncate text-sm font-medium">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
          </div>
          {onClearFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onClearFile}
            >
              Trocar arquivo
            </Button>
          )}
        </div>
        {config.footerHint ? (
          <p className="text-xs text-muted-foreground">{config.footerHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors",
          "hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <UploadCloud className="size-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Arraste o arquivo aqui ou clique para selecionar
          </span>
          <span className="text-xs text-muted-foreground">{config.subtitle}</span>
        </div>
        {config.formatBadges ? (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {config.formatBadges}
          </div>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {config.footerHint ? (
        <p className="text-xs text-muted-foreground">{config.footerHint}</p>
      ) : null}
    </div>
  );
}
