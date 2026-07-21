"use client";

import { FileJson, FileSpreadsheet } from "lucide-react";
import {
  ImportFileDropzone,
  type ImportFileDropzoneConfig,
} from "@/components/import/ImportFileDropzone";

const LEAD_IMPORT_DROPZONE_CONFIG: ImportFileDropzoneConfig = {
  accept: ".xlsx,.json",
  unsupportedFormatMessage: "Formato não suportado. Envie um arquivo .xlsx ou .json",
  subtitle: "Planilha Excel (.xlsx) ou arquivo JSON, com até 10MB",
  footerHint:
    "Na primeira linha da planilha devem estar os nomes das colunas. No JSON, envie uma lista de objetos em que cada chave vira uma coluna disponível para o mapeamento.",
  formatBadges: (
    <>
      <span className="flex items-center gap-1">
        <FileSpreadsheet className="size-4" />
        .xlsx
      </span>
      <span className="flex items-center gap-1">
        <FileJson className="size-4" />
        .json
      </span>
    </>
  ),
  validateFile: (file) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".json")) {
      return "Formato não suportado. Envie um arquivo .xlsx ou .json";
    }
    return null;
  },
};

interface LeadFileDropzoneProps {
  onFileSelected: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function LeadFileDropzone({ onFileSelected, onError, disabled }: LeadFileDropzoneProps) {
  return (
    <ImportFileDropzone
      config={LEAD_IMPORT_DROPZONE_CONFIG}
      onFileSelected={onFileSelected}
      onError={onError}
      disabled={disabled}
    />
  );
}
