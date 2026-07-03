import { FileText } from "lucide-react";
import type { ImportFileDropzoneConfig } from "./ImportFileDropzone";

const isPdfFile = (file: File) => {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || file.type === "application/pdf";
};

export const PDF_IMPORT_DROPZONE_CONFIG: ImportFileDropzoneConfig = {
  accept: ".pdf,application/pdf",
  unsupportedFormatMessage: "Formato não suportado. Envie um arquivo PDF (.pdf)",
  subtitle: "Documento PDF, com até 10MB",
  footerHint: "Somente arquivos PDF são aceitos. O documento será armazenado como versão do contrato.",
  formatBadges: (
    <span className="flex items-center gap-1">
      <FileText className="size-4" />
      .pdf
    </span>
  ),
  validateFile: (file) => {
    if (!isPdfFile(file)) {
      return "Formato não suportado. Envie um arquivo PDF (.pdf)";
    }
    return null;
  },
};
