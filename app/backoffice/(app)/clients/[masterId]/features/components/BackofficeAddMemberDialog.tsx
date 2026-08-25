"use client"

import { useState } from "react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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
  teamId: string
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
}

function defaultValues(): FormValues {
  return {
    fullName: "",
    email: "",
    phone: "",
    role: "operator",
    functions: [],
    teamId: "",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
  }
}

function sanitizePhone(value: string): string {
  const withoutCountryCode = value.replace(/^\+?55[\s-]?/, "")
  const digits = withoutCountryCode.replace(/\D/g, "")
  if (digits.length >= 10 && digits.length <= 11) return digits.slice(0, 11)
  return value.replace(/\D/g, "").slice(0, 11)
}

const ROLE_OPTIONS: { value: MemberRole; label: string; description: string }[] = [
  { value: "manager", label: "Manager", description: "Gerencia usuários e configurações do time." },
  { value: "backoffice", label: "Backoffice", description: "Acesso de gestão equivalente ao Manager (sem privilégios de master)." },
  { value: "operator", label: "Operator", description: "Acesso operacional aos leads e atividades do time." },
]

const FUNCTION_OPTIONS: { value: MemberFunction; label: string; description: string }[] = [
  { value: "SDR", label: "SDR", description: "Pode visualizar, editar e agendar os leads." },
  { value: "CLOSER", label: "Closer", description: "Mesmo acesso do SDR nos leads, mas só ele pode fechar contratos." },
]

interface BackofficeAddMemberDialogProps {
  open: boolean
  masterId: string
  teams: { id: string; name: string }[]
  masterUserType?: { slug: "common" | "member_pro"; isExpired: boolean }
  service: IBackofficeClientDetailsService
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

function defaultGenerateCharge(
  _userType?: { slug: "common" | "member_pro"; isExpired: boolean }
): boolean {
  return false
}

export function BackofficeAddMemberDialog({
  open,
  masterId,
  teams,
  masterUserType,
  service,
  onOpenChange,
  onSaved,
}: BackofficeAddMemberDialogProps) {
  const [values, setValues] = useState<FormValues>(defaultValues)
  const [generateCharge, setGenerateCharge] = useState(() => defaultGenerateCharge(masterUserType))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showChargeToggle =
    masterUserType?.slug === "member_pro" && !masterUserType.isExpired

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return
    if (!next) {
      setValues(defaultValues())
      setGenerateCharge(defaultGenerateCharge(masterUserType))
    }
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
    values.teamId !== "" &&
    !isSubmitting

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await service.addMember(masterId, {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: sanitizePhone(values.phone) || null,
        role: values.role,
        functions: values.functions,
        teamId: values.teamId,
        canCreateAccountUsers: values.role === "manager" ? values.canCreateAccountUsers : false,
        canManageAccountTeams: values.role === "manager" ? values.canManageAccountTeams : false,
        generateCharge: showChargeToggle ? generateCharge : false,
      })

      if (result.kind === "pending_payment") {
        toast.success("Cobrança pendente criada. O usuário será adicionado após o pagamento.", {
          description: result.checkoutUrl,
          action: {
            label: "Copiar link",
            onClick: () => void navigator.clipboard.writeText(result.checkoutUrl),
          },
        })
      } else {
        toast.success("Convite enviado ao usuário")
      }
      await onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toastUserError(err)
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
            <p className="text-xs text-muted-foreground">
              E-mails de outras contas também são aceitos. Será cobrada uma vaga adicional após
              confirmação do pagamento.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Time *</Label>
            <Select
              value={values.teamId}
              onValueChange={(v) => setValues((current) => ({ ...current, teamId: v }))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Nível de acesso</Label>
            <div className="flex flex-col gap-2">
              {ROLE_OPTIONS.map((item) => (
                <div
                  key={item.value}
                  className="flex items-center justify-between rounded-md border border-input px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                  <Switch
                    checked={values.role === item.value}
                    onCheckedChange={() => setValues((v) => ({ ...v, role: item.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Define o nível de acesso do usuário na aplicação.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Funções</Label>
            <div className="flex flex-col gap-2">
              {FUNCTION_OPTIONS.map((item) => (
                <div
                  key={item.value}
                  className="flex items-center justify-between rounded-md border border-input px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                  <Switch
                    checked={values.functions.includes(item.value)}
                    onCheckedChange={() => toggleFunction(item.value)}
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Selecione SDR, Closer ou ambos.</p>
          </div>

          {values.role === "manager" ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Permissões delegadas</p>
                <p className="text-xs text-muted-foreground">
                  Essas permissões adicionais só podem ser atribuídas pelo master da conta.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Pode cadastrar novos usuários</span>
                  <span className="text-xs text-muted-foreground">
                    Permite solicitar novos usuários da conta sujeitos à cobrança incremental.
                  </span>
                </div>
                <Switch
                  checked={values.canCreateAccountUsers}
                  onCheckedChange={(checked) =>
                    setValues((v) => ({ ...v, canCreateAccountUsers: checked }))
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Pode gerenciar times</span>
                  <span className="text-xs text-muted-foreground">
                    Permite criar, editar e deletar times da conta, sem transferir ownership.
                  </span>
                </div>
                <Switch
                  checked={values.canManageAccountTeams}
                  onCheckedChange={(checked) =>
                    setValues((v) => ({ ...v, canManageAccountTeams: checked }))
                  }
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : null}

          {showChargeToggle ? (
            <div className="flex flex-col gap-2">
              <Label>Cobrança</Label>
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Gerar cobrança</span>
                  <span className="text-xs text-muted-foreground">
                    Quando ligado, gera cobrança imediata (ex.: pagamento externo).
                  </span>
                </div>
                <Switch
                  checked={generateCharge}
                  onCheckedChange={setGenerateCharge}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : null}
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
