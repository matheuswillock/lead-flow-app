"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeUsers } from "../context/BackofficeUsersContext"
import type { CreateUserFormData } from "../services/IBackofficeUsersService"

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
  return email.trim().toLowerCase().endsWith("@corretorstudio.com")
}

export function BackofficeUsersContainer() {
  const { users, isLoading, isCreating, canManageUsers, createUser, updateUser } =
    useBackofficeUsers()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateUserFormData>(initialForm)
  const [emailError, setEmailError] = useState<string | null>(null)

  function handleChange(field: keyof CreateUserFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === "email") setEmailError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail(form.email)) {
      setEmailError("E-mail deve ser @corretorstudio.com")
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

  async function handleToggleActive(id: string, currentActive: boolean) {
    const result = await updateUser(id, { isActive: !currentActive })
    if (result.isValid) {
      toast.success(currentActive ? "Usuário desativado" : "Usuário ativado")
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao atualizar usuário")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Usuários Backoffice</h1>
        {canManageUsers && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
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
              <TableHead>Acesso Total</TableHead>
              <TableHead>Mailbox</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.fullAccess ? "default" : "secondary"}>
                        {u.fullAccess ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mailboxInfo.variant}>{mailboxInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {canManageUsers ? (
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={() => handleToggleActive(u.id, u.isActive)}
                        />
                      ) : (
                        <Badge variant={u.isActive ? "default" : "secondary"}>
                          {u.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Usuário Backoffice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail * (@corretorstudio.com)</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="nome@corretorstudio.com"
                required
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Nome do usuário"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temporaryPassword">Senha temporária *</Label>
              <Input
                id="temporaryPassword"
                type="password"
                value={form.temporaryPassword}
                onChange={(e) => handleChange("temporaryPassword", e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="fullAccess"
                checked={form.fullAccess}
                onCheckedChange={(v) => handleChange("fullAccess", v)}
              />
              <Label htmlFor="fullAccess">Acesso total</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
