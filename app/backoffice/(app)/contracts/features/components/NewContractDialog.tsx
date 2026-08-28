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
  DialogTrigger,
} from "@/components/ui/dialog"
import { ImportFileDropzone } from "@/components/import/ImportFileDropzone"
import { PDF_IMPORT_DROPZONE_CONFIG } from "@/components/import/pdfDropzoneConfig"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBackofficeContracts } from "../context/BackofficeContractsContext"

export function NewContractDialog() {
  const { clientOptions, createContract, isSaving } = useBackofficeContracts()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [clientId, setClientId] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)

  function resetForm() {
    setTitle("")
    setDescription("")
    setClientId("")
    setFile(null)
  }

  async function handleSubmit() {
    if (!title.trim() || !file) return

    const result = await createContract({
      title: title.trim(),
      description: description.trim() || undefined,
      clientId: clientId || undefined,
      file,
    })

    if (result.isValid) {
      toast.success("Contrato criado com sucesso")
      resetForm()
      setOpen(false)
    } else {
      toast.error(result.errorMessages[0] ?? "Erro ao criar contrato")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload data-icon="inline-start" />
          Novo contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="contract-title">Título</FieldLabel>
              <Input
                id="contract-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Contrato de Corretagem Padrão"
                disabled={isSaving}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="contract-description">Descrição</FieldLabel>
              <Textarea
                id="contract-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional"
                disabled={isSaving}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="contract-client">Cliente (opcional)</FieldLabel>
              <Select value={clientId} onValueChange={setClientId} disabled={isSaving}>
                <SelectTrigger id="contract-client" className="w-full">
                  <SelectValue placeholder="Sem cliente vinculado" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Arquivo PDF</FieldLabel>
              <ImportFileDropzone
                config={PDF_IMPORT_DROPZONE_CONFIG}
                selectedFile={file}
                selectedFileLabel="PDF do contrato"
                onClearFile={() => setFile(null)}
                onFileSelected={setFile}
                onError={(message) => toast.error(toUserToastMessage(message))}
                disabled={isSaving}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !title.trim() || !file}>
            {isSaving ? <Loader2 className="animate-spin" /> : "Criar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
