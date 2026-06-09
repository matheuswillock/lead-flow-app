"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { maskPhone } from "@/lib/masks"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

type MemberRole = "manager" | "backoffice" | "operator"
type MemberFunction = "SDR" | "CLOSER"

interface FormValues {
  fullName: string
  email: string
  phone: string
  role: MemberRole
  functions: MemberFunction[]
}

const ROLE_LABELS: Record<MemberRole, string> = {
  manager: "Gerente",
  backoffice: "Backoffice",
  operator: "Operador",
}

function defaultValues(): FormValues {
  return { fullName: "", email: "", phone: "", role: "operator", functions: [] }
}

function sanitizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11)
}

interface BackofficeAddMemberDialogProps {
  open: boolean
  masterId: string
  service: IBackofficeClientDetailsService
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

export function BackofficeAddMemberDialog({
  open,
  masterId,
  service,
  onOpenChange,
  onSaved,
}: BackofficeAddMemberDialogProps) {
  const [values, setValues] = useState<FormValues>(defaultValues)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return
    if (!next) setValues(defaultValues())
    onOpenChange(next)
  }

  function toggleFunction(fn: MemberFunction) {
    setValues((current) => ({
      ...current,
      functions: current.functions.includes(fn)
        ? current.functions.filter((f) => f !== fn)
        : [...current.functions, fn],
    }))
  }

  const canSubmit =
    values.fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) &&
    !isSubmitting

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      await service.addMember(masterId, {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: sanitizePhone(values.phone) || null,
        role: values.role,
        functions: values.functions,
      })
      toast.success("Convite enviado ao usuário")
      await onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar usuário")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar usuário</DialogTitle>
          <DialogDescription>
            O usuário receberá um e-mail de convite para acessar o Corretor Studio.
          </DialogDescription>
        </DialogHeader>

        <div className="dialog-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-member-name">Nome completo *</Label>
              <Input
                id="add-member-name"
                value={values.fullName}
                onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-member-phone">Telefone</Label>
              <Input
                id="add-member-phone"
                placeholder="(99) 99999-9999"
                value={maskPhone(values.phone)}
                onChange={(e) =>
                  setValues((v) => ({ ...v, phone: sanitizePhone(e.target.value) }))
                }
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-member-email">E-mail *</Label>
            <Input
              id="add-member-email"
              type="email"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Papel *</Label>
            <Select
              value={values.role}
              onValueChange={(v) => setValues((current) => ({ ...current, role: v as MemberRole }))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(Object.entries(ROLE_LABELS) as [MemberRole, string][]).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Atribuições</Label>
            <div className="flex gap-4">
              {(["SDR", "CLOSER"] as const).map((fn) => (
                <div key={fn} className="flex items-center gap-2">
                  <Checkbox
                    id={`add-member-fn-${fn}`}
                    checked={values.functions.includes(fn)}
                    onCheckedChange={() => toggleFunction(fn)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor={`add-member-fn-${fn}`}>{fn}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? "Enviando convite..." : "Adicionar usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
