import { useEffect, useState, type FormEvent } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { CreateUserFormData } from "../services/IBackofficeUsersService"
import { BackofficeEmailInput } from "./BackofficeEmailInput"

interface NewUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateUserFormData
  emailError: string | null
  isCreating: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onChange: (field: keyof CreateUserFormData, value: string | boolean) => void
}

export function NewUserDialog({
  open,
  onOpenChange,
  form,
  emailError,
  isCreating,
  onSubmit,
  onChange,
}: NewUserDialogProps) {
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) setShowPassword(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isCreating && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Usuário Backoffice</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="min-h-0 flex flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail *</Label>
                <BackofficeEmailInput
                  id="email"
                  value={form.email}
                  onValueChange={(email) => onChange("email", email)}
                  placeholder="nome"
                  disabled={isCreating}
                  required
                />
                {emailError ? <p className="text-xs text-destructive">{emailError}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fullName">Nome completo *</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(event) => onChange("fullName", event.target.value)}
                  placeholder="Nome do usuário"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="temporaryPassword">Senha temporária *</Label>
                <div className="relative">
                  <Input
                    id="temporaryPassword"
                    type={showPassword ? "text" : "password"}
                    value={form.temporaryPassword}
                    onChange={(event) => onChange("temporaryPassword", event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pr-10"
                    required
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isCreating}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-controls="temporaryPassword"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tipo de usuário</Label>
                <RadioGroup
                  value={form.fullAccess ? "master" : "operator"}
                  onValueChange={(value) => onChange("fullAccess", value === "master")}
                  disabled={isCreating}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="master" id="role-master" className="mt-0.5" />
                    <div>
                      <Label htmlFor="role-master" className="font-medium cursor-pointer">Master</Label>
                      <p className="text-xs text-muted-foreground">Acesso total ao backoffice</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="operator" id="role-operator" className="mt-0.5" />
                    <div>
                      <Label htmlFor="role-operator" className="font-medium cursor-pointer">Operador</Label>
                      <p className="text-xs text-muted-foreground">Apenas visualização</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
