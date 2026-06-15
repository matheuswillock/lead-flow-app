"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, FileJson, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface LeadFileDropzoneProps {
  onFileSelected: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const isSupportedFile = (file: File) => {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".json");
};

export function LeadFileDropzone({ onFileSelected, onError, disabled }: LeadFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!isSupportedFile(file)) {
      onError("Formato não suportado. Envie um arquivo .xlsx ou .json");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onError("O arquivo deve ter no máximo 10MB");
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
          <span className="text-xs text-muted-foreground">
            Planilha Excel (.xlsx) ou arquivo JSON, com até 10MB
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileSpreadsheet className="size-4" />
            .xlsx
          </span>
          <span className="flex items-center gap-1">
            <FileJson className="size-4" />
            .json
          </span>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.json"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        Na primeira linha da planilha devem estar os nomes das colunas. No JSON, envie uma lista de
        objetos em que cada chave vira uma coluna disponível para o mapeamento.
      </p>
    </div>
  );
}
