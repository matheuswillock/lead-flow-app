"use client"

import { useState } from "react"
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
import { Spinner } from "@/components/ui/spinner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  creating: boolean
  onCreate: (name: string, subject: string) => Promise<void>
}

export function CreateBackofficeTemplateDialog({ open, onOpenChange, creating, onCreate }: Props) {
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")

  const handleSubmit = async () => {
    if (!name.trim() || !subject.trim()) return
    await onCreate(name.trim(), subject.trim())
    setName("")
    setSubject("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar template</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Nome</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do template" />
          </Field>
          <Field>
            <FieldLabel>Assunto</FieldLabel>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do e-mail" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={creating || !name.trim() || !subject.trim()}
          >
            {creating ? <Spinner data-icon="inline-start" /> : null}
            Criar e abrir editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
