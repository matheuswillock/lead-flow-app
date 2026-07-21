import { FileJson, FileSpreadsheet } from "lucide-react"
import type { ImportFileDropzoneConfig } from "@/components/import/ImportFileDropzone"

const isCsvOrJsonFile = (file: File) => {
  const name = file.name.toLowerCase()
  return (
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    file.type === "text/csv" ||
    file.type === "application/json"
  )
}

export const CONTACT_IMPORT_DROPZONE_CONFIG: ImportFileDropzoneConfig = {
  accept: ".csv,.json,text/csv,application/json",
  unsupportedFormatMessage: "Formato não suportado. Envie um arquivo CSV (.csv) ou JSON (.json)",
  subtitle: "Arquivo CSV ou JSON, com até 10MB",
  footerHint:
    "O arquivo deve conter uma coluna/campo \"email\" (obrigatório) e, opcionalmente, \"name\".",
  formatBadges: (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1">
        <FileSpreadsheet className="size-4" />
        .csv
      </span>
      <span className="flex items-center gap-1">
        <FileJson className="size-4" />
        .json
      </span>
    </span>
  ),
  validateFile: (file) => {
    if (!isCsvOrJsonFile(file)) {
      return "Formato não suportado. Envie um arquivo CSV (.csv) ou JSON (.json)"
    }
    return null
  },
}
