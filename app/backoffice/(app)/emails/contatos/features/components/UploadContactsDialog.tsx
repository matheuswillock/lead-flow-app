"use client"

import { useState } from "react"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
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
import { CONTACT_IMPORT_DROPZONE_CONFIG } from "./contactImportDropzoneConfig"
import { useBackofficeEmailContatos } from "../context/BackofficeEmailContatosHook"
import type { BackofficeEmailContactListItem } from "../context/BackofficeEmailContatosTypes"

interface Props {
  list: BackofficeEmailContactListItem | null
  onOpenChange(open: boolean): void
}

export function UploadContactsDialog({ list, onOpenChange }: Props) {
  const { isSaving, uploadContacts } = useBackofficeEmailContatos()
  const [file, setFile] = useState<File | null>(null)

  async function handleSubmit() {
    if (!list || !file) return
    const ok = await uploadContacts(list.id, file)
    if (ok) {
      setFile(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={Boolean(list)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setFile(null)
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contatos — {list?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel>Arquivo CSV ou JSON</FieldLabel>
              <ImportFileDropzone
                config={CONTACT_IMPORT_DROPZONE_CONFIG}
                selectedFile={file}
                selectedFileLabel="Arquivo de contatos"
                onClearFile={() => setFile(null)}
                onFileSelected={setFile}
                onError={(message) => toast.error(toUserToastMessage(message))}
                disabled={isSaving}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !file}>
            {isSaving ? <Loader2 className="animate-spin" /> : (
              <>
                <Upload data-icon="inline-start" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
