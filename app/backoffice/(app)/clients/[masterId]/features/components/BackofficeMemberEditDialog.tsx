"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Crown, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { maskPhone, unmask } from "@/lib/masks"
import type {
  BackofficeClientDetails,
  BackofficeClientTeam,
  BackofficeClientTeamMember,
} from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"
import { BackofficeMemberTeamsSection, type ExternalTeamMembershipRow } from "./BackofficeMemberTeamsSection"

type MemberRole = "manager" | "backoffice" | "operator"
type MemberFunction = "SDR" | "CLOSER"

const ROLE_OPTIONS: { value: MemberRole; label: string; description: string }[] = [
  { value: "manager", label: "Manager", description: "Gerencia usuários e configurações do time." },
  { value: "backoffice", label: "Backoffice", description: "Acesso de gestão equivalente ao Manager (sem privilégios de master)." },
  { value: "operator", label: "Operator", description: "Acesso operacional aos leads e atividades do time." },
]

const FUNCTION_OPTIONS: { value: MemberFunction; label: string; description: string }[] = [
  { value: "SDR", label: "SDR", description: "Pode visualizar, editar e agendar os leads." },
  { value: "CLOSER", label: "Closer", description: "Mesmo acesso do SDR nos leads, mas só ele pode fechar contratos." },
]

interface FormState {
  fullName: string
  phone: string
  email: string
  role: MemberRole
  functions: MemberFunction[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  canViewAllTeams: boolean
}

function toRole(value: string): MemberRole {
  if (value === "manager" || value === "backoffice" || value === "operator") return value
  return "operator"
}

function toFunctions(values: string[]): MemberFunction[] {
  return values.filter((v): v is MemberFunction => v === "SDR" || v === "CLOSER")
}

function initForm(member: BackofficeClientTeamMember): FormState {
  return {
    fullName: member.fullName ?? "",
    phone: member.phone ?? "",
    email: member.email,
    role: toRole(member.role),
    functions: toFunctions(member.functions),
    canCreateAccountUsers: member.canCreateAccountUsers,
    canManageAccountTeams: member.canManageAccountTeams,
    canTransferAccountLeads: member.canTransferAccountLeads,
    canViewAllTeams: member.canViewAllTeams,
  }
}

function findTeamsOfMember(
  teams: BackofficeClientTeam[],
  memberId: string
): BackofficeClientTeam[] {
  return teams.filter((team) => team.members.some((m) => m.id === memberId))
}

interface BackofficeMemberEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: BackofficeClientTeamMember | null
  teamId: string | null
  details: BackofficeClientDetails | null
  service: IBackofficeClientDetailsService
  onSuccess: () => void
  onDeleteRequest: () => void
  canManage?: boolean
}

export function BackofficeMemberEditDialog({
  open,
  onOpenChange,
  member,
  teamId,
  details,
  service,
  onSuccess,
  onDeleteRequest,
  canManage = true,
}: BackofficeMemberEditDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    member
      ? initForm(member)
      : { fullName: "", phone: "", email: "", role: "operator", functions: [], canCreateAccountUsers: false, canManageAccountTeams: false, canTransferAccountLeads: false, canViewAllTeams: false }
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null)
  const [addingTeamId, setAddingTeamId] = useState<string | null>(null)
  const [externalTeams, setExternalTeams] = useState<ExternalTeamMembershipRow[]>([])
  const inFlight = useRef(false)

  useEffect(() => {
    if (open && member) {
      setForm(initForm(member))
      setAddingTeamId(null)
    }
  }, [open, member])

  useEffect(() => {
    if (!open || !member || !details?.id) {
      setExternalTeams([])
      return
    }

    let cancelled = false

    void service
      .getMemberExternalTeams(member.id, details.id)
      .then((items) => {
        if (!cancelled) setExternalTeams(items)
      })
      .catch(() => {
        if (!cancelled) setExternalTeams([])
      })

    return () => {
      cancelled = true
    }
  }, [open, member, details?.id, service])

  if (!member) return null

  const memberTeams = details ? findTeamsOfMember(details.teams, member.id) : []
  const memberTeamIds = new Set(memberTeams.map((team) => team.id))
  const allTeams = details?.allTeams ?? []

  const nameValid = form.fullName.trim().length >= 2
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const isValid = nameValid && emailValid

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!member || !isValid || inFlight.current) return

    inFlight.current = true
    setIsSubmitting(true)

    try {
      const fullNameChanged = form.fullName.trim() !== (member.fullName ?? "")
      const phoneRaw = unmask(form.phone)
      const memberPhoneRaw = member.phone ?? ""
      const phoneChanged = phoneRaw !== memberPhoneRaw
      const emailChanged = form.email.trim().toLowerCase() !== member.email.toLowerCase()
      const roleChanged = form.role !== toRole(member.role)
      const functionsChanged =
        JSON.stringify([...form.functions].sort()) !==
        JSON.stringify([...toFunctions(member.functions)].sort())
      const canCreateChanged = form.canCreateAccountUsers !== member.canCreateAccountUsers
      const canManageChanged = form.canManageAccountTeams !== member.canManageAccountTeams
      const canTransferChanged = form.canTransferAccountLeads !== member.canTransferAccountLeads
      const canViewAllTeamsChanged = form.canViewAllTeams !== member.canViewAllTeams

      const hasTransferPermission = form.role === "manager" || form.role === "backoffice"
      const effectiveCanTransfer = hasTransferPermission ? form.canTransferAccountLeads : false

      if (!fullNameChanged && !phoneChanged && !emailChanged && !roleChanged && !functionsChanged && !canCreateChanged && !canManageChanged && !canTransferChanged && !canViewAllTeamsChanged) {
        toast.info("Nenhuma alteração para salvar")
        onOpenChange(false)
        return
      }

      const effectiveCanCreate = form.role === "manager" ? form.canCreateAccountUsers : false
      const effectiveCanManage = form.role === "manager" ? form.canManageAccountTeams : false
      const effectiveCanViewAllTeams = (form.role === "manager" || form.role === "backoffice") ? form.canViewAllTeams : false

      const hasAccessChange =
        roleChanged ||
        functionsChanged ||
        canCreateChanged ||
        canManageChanged ||
        canTransferChanged ||
        canViewAllTeamsChanged

      const effectiveTeamId = teamId ?? memberTeams[0]?.id ?? null
      const accountMasterId = details?.id

      await service.updateMember(member.id, {
        ...(fullNameChanged ? { fullName: form.fullName.trim() } : {}),
        ...(phoneChanged ? { phone: phoneRaw.length > 0 ? phoneRaw : null } : {}),
        ...(emailChanged ? { email: form.email.trim().toLowerCase() } : {}),
        ...(roleChanged ? { role: form.role } : {}),
        ...(roleChanged || functionsChanged ? { functions: form.functions } : {}),
        ...(roleChanged || canCreateChanged ? { canCreateAccountUsers: effectiveCanCreate } : {}),
        ...(roleChanged || canManageChanged ? { canManageAccountTeams: effectiveCanManage } : {}),
        ...(roleChanged || canTransferChanged ? { canTransferAccountLeads: effectiveCanTransfer } : {}),
        ...(roleChanged || canViewAllTeamsChanged ? { canViewAllTeams: effectiveCanViewAllTeams } : {}),
        ...(hasAccessChange && accountMasterId ? { accountMasterId } : {}),
        ...(hasAccessChange && !accountMasterId && effectiveTeamId ? { teamId: effectiveTeamId } : {}),
      })

      toast.success("Membro atualizado com sucesso")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar membro")
    } finally {
      setIsSubmitting(false)
      inFlight.current = false
    }
  }

  async function handleRemoveFromTeam(teamId: string) {
    if (!member || removingTeamId) return
    setRemovingTeamId(teamId)
    try {
      await service.removeMemberFromTeam(member.id, teamId)
      toast.success("Membro removido do time")
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover do time")
    } finally {
      setRemovingTeamId(null)
    }
  }

  async function handleAddToTeam(teamId: string) {
    if (!member || addingTeamId) return
    setAddingTeamId(teamId)
    try {
      await service.addMemberToTeam(member.id, teamId)
      toast.success("Membro adicionado ao time")
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar ao time")
    } finally {
      setAddingTeamId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-140">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar membro
            {member.isMaster ? (
              <Badge
                variant="outline"
                className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"
              >
                <Crown className="size-3 mr-1" />
                Master
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-5 pr-1">
            <div className="space-y-2">
              <Label htmlFor="member-fullName">Nome completo</Label>
              <Input
                id="member-fullName"
                value={form.fullName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Nome do membro"
                disabled={isSubmitting}
              />
              {form.fullName.length > 0 && !nameValid && (
                <p className="text-xs text-destructive">Mínimo de 2 caracteres</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-phone">Telefone</Label>
                <Input
                  id="member-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={maskPhone(form.phone)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      phone: unmask(maskPhone(event.target.value)),
                    }))
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-email">E-mail</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  disabled={isSubmitting}
                />
                {form.email.length > 0 && !emailValid && (
                  <p className="text-xs text-destructive">E-mail inválido</p>
                )}
              </div>
            </div>

            {!member.isMaster ? (
              <>
                <Separator />

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
                          checked={form.role === item.value}
                          onCheckedChange={() => setForm((prev) => ({ ...prev, role: item.value }))}
                          disabled={isSubmitting}
                        />
                      </div>
                    ))}
                  </div>
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
                          checked={form.functions.includes(item.value)}
                          onCheckedChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              functions: prev.functions.includes(item.value)
                                ? prev.functions.filter((f) => f !== item.value)
                                : [...prev.functions, item.value],
                            }))
                          }
                          disabled={isSubmitting}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {form.role === "manager" ? (
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
                        checked={form.canCreateAccountUsers}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, canCreateAccountUsers: checked }))
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
                        checked={form.canManageAccountTeams}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, canManageAccountTeams: checked }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                ) : null}

                {(form.role === "manager" || form.role === "backoffice") ? (
                  <div className="flex flex-col gap-3">
                    {form.role === "backoffice" && (
                      <div>
                        <p className="text-sm font-medium">Permissões delegadas</p>
                        <p className="text-xs text-muted-foreground">
                          Essas permissões adicionais só podem ser atribuídas pelo master da conta.
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Pode transferir leads entre times</span>
                        <span className="text-xs text-muted-foreground">
                          Permite repassar leads para outro time da conta neste time. Válido somente para este time.
                        </span>
                      </div>
                      <Switch
                        checked={form.canTransferAccountLeads}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, canTransferAccountLeads: checked }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Pode visualizar todos os times</span>
                        <span className="text-xs text-muted-foreground">
                          Permite ver métricas do Dashboard e Performance de todos os times da conta.
                        </span>
                      </div>
                      <Switch
                        checked={form.canViewAllTeams}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, canViewAllTeams: checked }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            <BackofficeMemberTeamsSection
              teams={allTeams}
              memberTeamIds={memberTeamIds}
              member={member}
              externalTeams={externalTeams}
              canManage={canManage}
              isSubmitting={isSubmitting}
              addingTeamId={addingTeamId}
              removingTeamId={removingTeamId}
              onAddToTeam={(teamId) => void handleAddToTeam(teamId)}
              onRemoveFromTeam={(teamId) => void handleRemoveFromTeam(teamId)}
            />

            {!member.isMaster ? (
              <>
                <Separator />
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-destructive">Zona de perigo</p>
                  <p className="text-sm text-muted-foreground">
                    Excluir esta conta remove permanentemente o usuário e todos os seus
                    dados de leads atribuídos.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={onDeleteRequest}
                    disabled={isSubmitting}
                  >
                    <Trash2 />
                    Excluir conta
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="pt-4 mt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
