"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, FilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useBackofficeContracts } from "../context/BackofficeContractsContext"

export function NewVersionDialog({
  contractId,
  contractTitle,
  open,
  onOpenChange,
}: {
  contractId: string
  contractTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { addVersion, isSaving } = useBackofficeContracts()
  const [file, setFile] = useState<File | null>(null)

  async function handleSubmit() {
    if (!file) return

    const result = await addVersion(contractId, file)
    if (result.isValid) {
      toast.success("Nova versão importada com sucesso")
      setFile(null)
      onOpenChange(false)
    } else {
      toast.error(result.errorMessages[0] ?? "Erro ao importar nova versão")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setFile(null)
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar nova versão</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel>Contrato</FieldLabel>
              <p className="text-sm text-muted-foreground">{contractTitle}</p>
            </Field>
            <Field>
              <FieldLabel htmlFor="version-file">Novo arquivo PDF</FieldLabel>
              <Input
                id="version-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                <FilePlus data-icon="inline-start" />
                Importar versão
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
