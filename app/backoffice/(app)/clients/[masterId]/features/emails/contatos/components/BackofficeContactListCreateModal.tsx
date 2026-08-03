"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import type { UseBackofficeContatosReturn } from "../hooks/useBackofficeContatos"

type Props = Pick<UseBackofficeContatosReturn, "canManage" | "creatingList" | "handleCreateList">

export function BackofficeContactListCreateModal({
  canManage,
  creatingList,
  handleCreateList,
}: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  function resetForm() {
    setName("")
    setDescription("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    try {
      await handleCreateList(trimmedName, description.trim() || undefined)
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
        if (!creatingList) {
          setOpen(next)
          if (!next) resetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          + Nova lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova lista de contatos</DialogTitle>
          <DialogDescription>
            Crie uma lista para organizar os contatos de e-mail do cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="list-name">Nome *</FieldLabel>
              <Input
                id="list-name"
                placeholder="Ex: Leads Novos Janeiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creatingList}
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="list-description">Descrição</FieldLabel>
              <Textarea
                id="list-description"
                placeholder="Descrição opcional da lista..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={creatingList}
                className="min-h-20 resize-none"
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={creatingList}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creatingList || !name.trim()}>
              {creatingList ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              {creatingList ? "Criando..." : "Criar lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
