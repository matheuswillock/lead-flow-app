"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Crown, Trash2, UserMinus } from "lucide-react"
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
import { maskPhone, unmask } from "@/lib/masks"
import type {
  BackofficeClientDetails,
  BackofficeClientTeam,
  BackofficeClientTeamMember,
} from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface FormState {
  fullName: string
  phone: string
  email: string
}

function initForm(member: BackofficeClientTeamMember): FormState {
  return {
    fullName: member.fullName ?? "",
    phone: member.phone ?? "",
    email: member.email,
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
  details: BackofficeClientDetails | null
  service: IBackofficeClientDetailsService
  onSuccess: () => void
  onDeleteRequest: () => void
}

export function BackofficeMemberEditDialog({
  open,
  onOpenChange,
  member,
  details,
  service,
  onSuccess,
  onDeleteRequest,
}: BackofficeMemberEditDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    member ? initForm(member) : { fullName: "", phone: "", email: "" }
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (open && member) {
      setForm(initForm(member))
    }
  }, [open, member])

  if (!member) return null

  const memberTeams = details ? findTeamsOfMember(details.teams, member.id) : []

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

      if (!fullNameChanged && !phoneChanged && !emailChanged) {
        toast.info("Nenhuma alteração para salvar")
        onOpenChange(false)
        return
      }

      await service.updateMember(member.id, {
        ...(fullNameChanged ? { fullName: form.fullName.trim() } : {}),
        ...(phoneChanged ? { phone: phoneRaw.length > 0 ? phoneRaw : null } : {}),
        ...(emailChanged ? { email: form.email.trim().toLowerCase() } : {}),
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

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[560px]">
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

            <Separator />

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Times deste cliente</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remova o membro de um time específico sem excluir a conta.
                </p>
              </div>

              {memberTeams.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  Este membro não pertence a nenhum time deste cliente.
                </p>
              ) : (
                <div className="rounded-md border divide-y">
                  {memberTeams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.membersCount} membro{team.membersCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRemoveFromTeam(team.id)}
                        disabled={
                          isSubmitting ||
                          removingTeamId !== null ||
                          member.isMaster
                        }
                        title={
                          member.isMaster
                            ? "Não é possível remover o usuário master do time"
                            : undefined
                        }
                      >
                        <UserMinus />
                        {removingTeamId === team.id ? "Removendo..." : "Remover"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
