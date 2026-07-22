'use client'

import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useDialerContext } from '../context/DialerContext'
import type { UploadContactsResult } from '../context/DialerTypes'

interface UploadContactsDialogProps {
  campaignId: string | null
  onClose: () => void
}

export function UploadContactsDialog({ campaignId, onClose }: UploadContactsDialogProps) {
  const { uploading, handleUploadContacts } = useDialerContext()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadContactsResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFile(null)
      setResult(null)
      onClose()
    }
  }

  const handleSubmit = async () => {
    if (!campaignId || !file || uploading) return
    const uploadResult = await handleUploadContacts(campaignId, file)
    if (uploadResult) {
      setResult(uploadResult)
      setFile(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <Dialog open={campaignId !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Envie um arquivo .xlsx ou .json com as colunas name, phone e email (opcional).
            Telefones são normalizados para o formato +55.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dialer-contacts-file">Arquivo</FieldLabel>
              <Input
                id="dialer-contacts-file"
                ref={inputRef}
                type="file"
                accept=".xlsx,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <FieldDescription>
                Limite de 10.000 contatos por campanha e 10MB por arquivo. Telefones duplicados
                são ignorados.
              </FieldDescription>
            </Field>

            {result && (
              <Field>
                <FieldLabel>Resultado da importação</FieldLabel>
                <ul className="text-sm text-muted-foreground flex flex-col gap-1">
                  <li>{result.inserted} contatos importados</li>
                  <li>{result.duplicates} duplicados ignorados</li>
                  <li>{result.invalidRows} linhas inválidas</li>
                  <li>{result.totalContacts} contatos no total na campanha</li>
                </ul>
                {result.errors.length > 0 && (
                  <ul className="text-sm text-destructive flex flex-col gap-1">
                    {result.errors.slice(0, 5).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </Field>
            )}
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={uploading}>
            Fechar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? <Spinner data-icon="inline-start" /> : <FileUp data-icon="inline-start" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
