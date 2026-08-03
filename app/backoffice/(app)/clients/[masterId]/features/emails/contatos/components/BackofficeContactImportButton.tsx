"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ImportFileDropzone } from "@/components/import/ImportFileDropzone"
import type { UseBackofficeContatosReturn } from "../hooks/useBackofficeContatos"

const CONTACT_IMPORT_DROPZONE_CONFIG = {
  accept: ".csv,text/csv",
  unsupportedFormatMessage: "Formato não suportado. Envie um arquivo CSV (.csv)",
  subtitle: "Arquivo CSV, com até 10MB",
  footerHint:
    'O arquivo deve conter uma coluna "email" (obrigatória) e, opcionalmente, "name".',
  validateFile: (file: File) => {
    const name = file.name.toLowerCase()
    const valid = name.endsWith(".csv") || file.type === "text/csv"
    return valid ? null : "Formato não suportado. Envie um arquivo CSV (.csv)"
  },
}

type Props = Pick<
  UseBackofficeContatosReturn,
  "canManage" | "uploading" | "handleUploadContacts" | "selectedListId"
> & {
  listName?: string
}

export function BackofficeContactImportButton({
  canManage,
  uploading,
  handleUploadContacts,
  selectedListId,
  listName,
}: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  if (!canManage || !selectedListId) return null

  async function handleSubmit() {
    if (!file) return
    const ok = await handleUploadContacts(file)
    if (ok) {
      setFile(null)
      setOpen(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload data-icon="inline-start" />
        Importar CSV
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!uploading) {
            setOpen(next)
            if (!next) setFile(null)
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar contatos — {listName}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <FieldGroup>
              <Field>
                <FieldLabel>Arquivo CSV</FieldLabel>
                <ImportFileDropzone
                  config={CONTACT_IMPORT_DROPZONE_CONFIG}
                  selectedFile={file}
                  selectedFileLabel="Arquivo de contatos"
                  onClearFile={() => setFile(null)}
                  onFileSelected={setFile}
                  onError={(message) => toast.error(message)}
                  disabled={uploading}
                />
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={uploading || !file}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload data-icon="inline-start" />}
              {uploading ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
