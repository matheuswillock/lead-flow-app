"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Copy, MoreHorizontal, Pencil, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeUsers } from "../context/BackofficeUsersContext"
import type {
  BackofficeUserItem,
  CreateUserFormData,
  UpdateUserFormData,
} from "../services/IBackofficeUsersService"
import { NewUserDialog } from "../components/NewUserDialog"
import { EditUserDialog } from "../components/EditUserDialog"
import { isBackofficeEmail } from "../components/BackofficeEmailInput"

const MAILBOX_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  provisioned: { label: "Ativo", variant: "default" },
  pending_manual_action: { label: "Pendente", variant: "outline" },
}

const initialForm: CreateUserFormData = {
  email: "",
  fullName: "",
  temporaryPassword: "",
  fullAccess: false,
}

function validateEmail(email: string) {
  return isBackofficeEmail(email)
}

export function BackofficeUsersContainer() {
  const {
    users,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    canManageUsers,
    createUser,
    updateUser,
    deleteUser,
  } = useBackofficeUsers()
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<BackofficeUserItem | null>(null)
  const [form, setForm] = useState<CreateUserFormData>(initialForm)
  const [emailError, setEmailError] = useState<string | null>(null)

  function handleChange(field: keyof CreateUserFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === "email") setEmailError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail(form.email)) {
      setEmailError("Informe o prefixo do e-mail @corretorstudio.com.br")
      return
    }

    const result = await createUser(form)
    if (result.isValid) {
      toast.success("Usuário backoffice criado com sucesso")
      setOpen(false)
      setForm(initialForm)
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao criar usuário")
    }
  }

  function handleEditUser(user: BackofficeUserItem) {
    setSelectedUser(user)
    setEditOpen(true)
  }

  function handleEditOpenChange(nextOpen: boolean) {
    setEditOpen(nextOpen)
    if (!nextOpen) setSelectedUser(null)
  }

  async function handleUpdateUser(id: string, data: UpdateUserFormData) {
    const result = await updateUser(id, data)
    if (result.isValid) {
      if (data.isActive !== undefined && Object.keys(data).length === 1) {
        toast.success(data.isActive ? "Usuário ativado" : "Usuário desativado")
      } else {
        toast.success("Usuário atualizado com sucesso")
      }
      return
    }

    const message = result.errorMessages?.[0] ?? "Erro ao atualizar usuário"
    toast.error(message)
    throw new Error(message)
  }

  async function handleDeleteUser(id: string) {
    const result = await deleteUser(id)
    if (result.isValid) {
      toast.success("Usuário excluído com sucesso")
      setEditOpen(false)
      setSelectedUser(null)
      return
    }

    const message = result.errorMessages?.[0] ?? "Erro ao excluir usuário"
    toast.error(message)
    throw new Error(message)
  }

  async function handleCopyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      toast.success(`O e-mail ${email} foi copiado`)
    } catch (error) {
      console.error("[BackofficeUsersContainer][copyEmail]", error)
      toast.error("Não foi possível copiar o e-mail")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Usuários Backoffice</h1>
        {canManageUsers && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            Criar Usuário
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Funções</TableHead>
              <TableHead>Mailbox</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum usuário backoffice cadastrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const mailboxInfo = MAILBOX_LABELS[u.mailboxStatus] ?? {
                  label: u.mailboxStatus,
                  variant: "secondary" as const,
                }

                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.profile.fullName ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{u.email}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => void handleCopyEmail(u.email)}
                          aria-label={`Copiar e-mail ${u.email}`}
                        >
                          <Copy />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.fullAccess ? "default" : "outline"}>
                        {u.fullAccess ? "Manager" : "Operator"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.isSdr ? <Badge variant="outline">SDR</Badge> : null}
                        {u.isCloser ? <Badge variant="outline">Closer</Badge> : null}
                        {!u.isSdr && !u.isCloser ? (
                          <Badge variant="secondary">Sem função</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mailboxInfo.variant}>{mailboxInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <div className="flex items-center gap-2">
                          <Check className="size-4 text-primary" />
                          <span className="sr-only">Ativo</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <X className="size-4 text-muted-foreground" />
                          <span className="sr-only">Inativo</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {canManageUsers && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Ações de ${u.email}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => handleEditUser(u)}>
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <NewUserDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        emailError={emailError}
        isCreating={isCreating}
        onSubmit={handleSubmit}
        onChange={handleChange}
      />
      <EditUserDialog
        open={editOpen}
        user={selectedUser}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
        onOpenChange={handleEditOpenChange}
        onUpdate={handleUpdateUser}
        onDelete={handleDeleteUser}
      />
    </div>
  )
}
