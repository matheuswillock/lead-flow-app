"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type {
  BackofficeUserItem,
  UpdateUserFormData,
} from "../services/IBackofficeUsersService"
import { BackofficeEmailInput, isBackofficeEmail } from "./BackofficeEmailInput"

interface EditUserFormState {
  email: string
  fullName: string
  fullAccess: boolean
  isActive: boolean
  isSdr: boolean
  isCloser: boolean
}

interface EditUserDialogProps {
  open: boolean
  user: BackofficeUserItem | null
  isUpdating: boolean
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, data: UpdateUserFormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const initialForm: EditUserFormState = {
  email: "",
  fullName: "",
  fullAccess: false,
  isActive: false,
  isSdr: true,
  isCloser: true,
}

export function EditUserDialog({
  open,
  user,
  isUpdating,
  isDeleting,
  onOpenChange,
  onUpdate,
  onDelete,
}: EditUserDialogProps) {
  const [form, setForm] = useState<EditUserFormState>(initialForm)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isPending = isUpdating || isDeleting

  useEffect(() => {
    if (!user) {
      setForm(initialForm)
      setEmailError(null)
      setNameError(null)
      setDeleteOpen(false)
      return
    }

    setForm({
      email: user.email,
      fullName: user.profile.fullName ?? "",
      fullAccess: user.fullAccess,
      isActive: user.isActive,
      isSdr: user.isSdr,
      isCloser: user.isCloser,
    })
    setEmailError(null)
    setNameError(null)
  }, [user])

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) onOpenChange(nextOpen)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const fullName = form.fullName.trim()
    if (fullName.length < 2) {
      setNameError("Nome completo deve ter pelo menos 2 caracteres")
      return
    }
    if (!isBackofficeEmail(form.email)) {
      setEmailError("Informe o prefixo do e-mail @corretorstudio.com")
      return
    }

    try {
      await onUpdate(user.id, {
        email: form.email,
        fullName,
        fullAccess: form.fullAccess,
        isActive: form.isActive,
        isSdr: form.isSdr,
        isCloser: form.isCloser,
      })
      onOpenChange(false)
    } catch {
      // Toast de erro é emitido pelo container.
    }
  }

  async function handleConfirmDelete() {
    if (!user) return
    try {
      await onDelete(user.id)
      setDeleteOpen(false)
    } catch {
      // Toast de erro é emitido pelo container.
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>{user?.email ?? "Usuário backoffice"}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="min-h-0 flex flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editFullName">Nome completo *</Label>
                  <Input
                    id="editFullName"
                    value={form.fullName}
                    onChange={(event) => {
                      setNameError(null)
                      setForm((current) => ({ ...current, fullName: event.target.value }))
                    }}
                    placeholder="Nome do usuário"
                    disabled={isPending}
                    required
                  />
                  {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="editEmail">E-mail</Label>
                  <BackofficeEmailInput
                    id="editEmail"
                    value={form.email}
                    onValueChange={(email) => {
                      setEmailError(null)
                      setForm((current) => ({ ...current, email }))
                    }}
                    placeholder="nome"
                    disabled={isPending}
                    required
                  />
                  {emailError ? <p className="text-xs text-destructive">{emailError}</p> : null}
                </div>

                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <Label>Tipo de usuário</Label>
                  <RadioGroup
                    value={form.fullAccess ? "master" : "operator"}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, fullAccess: value === "master" }))
                    }
                    disabled={isPending}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="master" id="edit-role-master" className="mt-0.5" />
                      <div>
                        <Label htmlFor="edit-role-master" className="font-medium cursor-pointer">Master</Label>
                        <p className="text-xs text-muted-foreground">Acesso total ao backoffice</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="operator" id="edit-role-operator" className="mt-0.5" />
                      <div>
                        <Label htmlFor="edit-role-operator" className="font-medium cursor-pointer">Operador</Label>
                        <p className="text-xs text-muted-foreground">Apenas visualização</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="editIsActive">Status do usuário</Label>
                    <p className="text-xs text-muted-foreground">
                      {form.isActive
                        ? "Usuário ativo pode acessar o backoffice."
                        : "Usuário inativo não pode acessar o backoffice."}
                    </p>
                  </div>
                  <Switch
                    id="editIsActive"
                    checked={form.isActive}
                    onCheckedChange={(value) =>
                      setForm((current) => ({ ...current, isActive: value }))
                    }
                    disabled={isPending}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="editIsSdr">SDR</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários SDR aparecem nos filtros e campos de atendimento inicial do CRM.
                    </p>
                  </div>
                  <Switch
                    id="editIsSdr"
                    checked={form.isSdr}
                    onCheckedChange={(value) =>
                      setForm((current) => ({ ...current, isSdr: value }))
                    }
                    disabled={isPending}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="editIsCloser">Closer</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários Closer aparecem nos filtros e no agendamento obrigatório.
                    </p>
                  </div>
                  <Switch
                    id="editIsCloser"
                    checked={form.isCloser}
                    onCheckedChange={(value) =>
                      setForm((current) => ({ ...current, isCloser: value }))
                    }
                    disabled={isPending}
                  />
                </div>

                <Separator />

                <div className="flex flex-col gap-3 rounded-md border border-destructive/40 p-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium text-destructive">Zona de perigo</h3>
                    <p className="text-xs text-muted-foreground">
                      Excluir remove o usuário backoffice e o acesso de autenticação.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isPending || !user}
                    className="self-start"
                  >
                    <Trash2 data-icon="inline-start" />
                    Excluir usuário
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !user}>
                {isUpdating ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={(nextOpen) => !isDeleting && setDeleteOpen(nextOpen)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove {user?.email ?? "este usuário"} do backoffice. Ela não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {isDeleting ? "Excluindo..." : "Excluir usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
