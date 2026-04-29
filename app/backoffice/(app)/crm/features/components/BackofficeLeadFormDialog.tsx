"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"

interface FormState {
  name: string
  email: string
  phone: string
  notes: string
}

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", notes: "" }

export function BackofficeLeadFormDialog() {
  const {
    isFormDialogOpen,
    closeFormDialog,
    selectedLead,
    createLead,
    updateLead,
    removeLead,
  } = useBackofficeCrm()
  const isEdit = selectedLead !== null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    if (!isFormDialogOpen) return
    if (selectedLead) {
      setForm({
        name: selectedLead.name,
        email: selectedLead.email ?? "",
        phone: selectedLead.phone ?? "",
        notes: selectedLead.notes ?? "",
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [isFormDialogOpen, selectedLead])

  const isNameValid = form.name.trim().length >= 2
  const canSubmit = isNameValid && !isSubmitting && !isRemoving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      if (isEdit && selectedLead) {
        await updateLead(selectedLead.id, {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        })
      } else {
        await createLead({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        })
      }
      closeFormDialog()
    } catch (err) {
      console.error("[BackofficeLeadFormDialog][submit]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar lead")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRemove() {
    if (!selectedLead) return
    setIsRemoving(true)
    try {
      await removeLead(selectedLead.id)
      closeFormDialog()
    } catch (err) {
      console.error("[BackofficeLeadFormDialog][remove]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao remover lead")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Dialog
      open={isFormDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeFormDialog()
      }}
    >
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize as informações do lead do backoffice."
              : "Cadastre um novo lead no funil do backoffice."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="backoffice-lead-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 px-1"
        >
          <div className="space-y-2">
            <Label htmlFor="bo-lead-name">Nome *</Label>
            <Input
              id="bo-lead-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome completo"
              autoFocus
            />
            {!isNameValid && form.name.length > 0 && (
              <p className="text-xs text-destructive">
                Informe ao menos 2 caracteres.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bo-lead-email">E-mail</Label>
            <Input
              id="bo-lead-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contato@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bo-lead-phone">Telefone</Label>
            <Input
              id="bo-lead-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bo-lead-notes">Observações</Label>
            <Textarea
              id="bo-lead-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Anotações sobre o lead"
              rows={4}
            />
          </div>
        </form>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving || isSubmitting}
            >
              {isRemoving ? "Removendo..." : "Remover"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeFormDialog}
              disabled={isSubmitting || isRemoving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="backoffice-lead-form"
              disabled={!canSubmit}
            >
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar lead"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
