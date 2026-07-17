"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useBackofficeEmailContatos } from "../context/BackofficeEmailContatosHook"

export function CreateContactListDialog() {
  const { isSaving, createContactList } = useBackofficeEmailContatos()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  async function handleSubmit() {
    if (!name.trim()) return
    const ok = await createContactList(name.trim())
    if (ok) {
      setName("")
      setOpen(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setName("")
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Nova lista
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova lista de contatos</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="list-name">Nome</FieldLabel>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Clientes VIP"
                disabled={isSaving}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !name.trim()}>
            {isSaving ? <Loader2 className="animate-spin" /> : "Criar lista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
