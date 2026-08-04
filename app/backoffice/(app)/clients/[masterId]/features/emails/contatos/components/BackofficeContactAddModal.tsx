"use client"

import { useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { UseBackofficeContatosReturn } from "../hooks/useBackofficeContatos"

type Props = Pick<
  UseBackofficeContatosReturn,
  "canManage" | "addingContact" | "handleAddContact"
> & {
  disabled?: boolean
}

export function BackofficeContactAddModal({
  canManage,
  addingContact,
  handleAddContact,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")

  function resetForm() {
    setEmail("")
    setName("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    try {
      await handleAddContact(trimmedEmail, name.trim() || undefined)
      setOpen(false)
      resetForm()
    } catch {
      // toast in hook
    }
  }

  if (!canManage) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!addingContact) {
          setOpen(next)
          if (!next) resetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          + Adicionar contato
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar contato</DialogTitle>
          <DialogDescription>
            Adicione um contato manualmente à lista selecionada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="contact-email">E-mail *</FieldLabel>
              <Input
                id="contact-email"
                type="email"
                placeholder="contato@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={addingContact}
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-name">Nome</FieldLabel>
              <Input
                id="contact-name"
                placeholder="Nome do contato"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={addingContact}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={addingContact}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={addingContact || !email.trim()}>
              {addingContact ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <UserPlus data-icon="inline-start" />
              )}
              {addingContact ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
