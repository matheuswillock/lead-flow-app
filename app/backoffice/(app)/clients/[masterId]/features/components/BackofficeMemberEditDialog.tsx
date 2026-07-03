"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { maskPhone, unmask } from "@/lib/masks"
import type {
  BackofficeClientDetails,
  BackofficeClientTeamMember,
} from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"
import {
  BackofficeMemberTeamAccordions,
  type ExternalTeamMembershipRow,
} from "./BackofficeMemberTeamAccordions"
import {
  accessChanged,
  buildAccessUpdatePayload,
  buildTeamsDraft,
  type TeamMembershipDraft,
} from "../utils/memberTeamAccessUtils"

interface ProfileFormState {
  fullName: string
  phone: string
  email: string
}

function initProfileForm(member: BackofficeClientTeamMember): ProfileFormState {
  return {
    fullName: member.fullName ?? "",
    phone: member.phone ?? "",
    email: member.email,
  }
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
  details,
  service,
  onSuccess,
  onDeleteRequest,
  canManage = true,
}: BackofficeMemberEditDialogProps) {
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() =>
    member
      ? initProfileForm(member)
      : { fullName: "", phone: "", email: "" }
  )
  const [teamsDraft, setTeamsDraft] = useState<Record<string, TeamMembershipDraft>>({})
  const [externalTeams, setExternalTeams] = useState<ExternalTeamMembershipRow[]>([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (open && member) {
      setProfileForm(initProfileForm(member))
    }
  }, [open, member])

  useEffect(() => {
    if (!open || !member || !details?.id) {
      setTeamsDraft({})
      setExternalTeams([])
      setIsLoadingTeams(false)
      return
    }

    let cancelled = false
    setIsLoadingTeams(true)

    void Promise.all([
      service.getMemberAccountTeams(member.id, details.id),
      service.getMemberExternalTeams(member.id, details.id),
    ])
      .then(([accountTeams, external]) => {
        if (cancelled) return
        setTeamsDraft(buildTeamsDraft(accountTeams))
        setExternalTeams(external)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[BackofficeMemberEditDialog][loadTeams]", err)
        toast.error("Falha ao carregar times da conta")
        setTeamsDraft({})
        setExternalTeams([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTeams(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, member, details?.id, service])

  const defaultExpandedTeamIds = useMemo(
    () =>
      Object.values(teamsDraft)
        .filter((team) => team.isMember && !team.isPendingRemove)
        .map((team) => team.teamId),
    [teamsDraft]
  )

  if (!member) return null

  const nameValid = profileForm.fullName.trim().length >= 2
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())
  const isValid = nameValid && emailValid

  function hasTeamDraftChanges() {
    return Object.values(teamsDraft).some((team) => {
      if (team.isPendingAdd || team.isPendingRemove) return true
      if (team.isMember && team.originalAccess) {
        return accessChanged(team.access, team.originalAccess)
      }
      return false
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!member || !isValid || inFlight.current) return

    const fullNameChanged = profileForm.fullName.trim() !== (member.fullName ?? "")
    const phoneRaw = unmask(profileForm.phone)
    const memberPhoneRaw = member.phone ?? ""
    const phoneChanged = phoneRaw !== memberPhoneRaw
    const emailChanged = profileForm.email.trim().toLowerCase() !== member.email.toLowerCase()
    const teamChanges = hasTeamDraftChanges()

    if (!fullNameChanged && !phoneChanged && !emailChanged && !teamChanges) {
      toast.info("Nenhuma alteração para salvar")
      onOpenChange(false)
      return
    }

    inFlight.current = true
    setIsSubmitting(true)

    try {
      if (fullNameChanged || phoneChanged || emailChanged) {
        await service.updateMember(member.id, {
          ...(fullNameChanged ? { fullName: profileForm.fullName.trim() } : {}),
          ...(phoneChanged ? { phone: phoneRaw.length > 0 ? phoneRaw : null } : {}),
          ...(emailChanged ? { email: profileForm.email.trim().toLowerCase() } : {}),
        })
      }

      const pendingRemovals = Object.values(teamsDraft).filter((team) => team.isPendingRemove)
      const pendingAdds = Object.values(teamsDraft).filter((team) => team.isPendingAdd)
      const pendingUpdates = Object.values(teamsDraft).filter(
        (team) =>
          team.isMember &&
          !team.isPendingAdd &&
          !team.isPendingRemove &&
          team.originalAccess &&
          accessChanged(team.access, team.originalAccess)
      )

      for (const team of pendingRemovals) {
        await service.removeMemberFromTeam(member.id, team.teamId)
      }

      for (const team of pendingAdds) {
        const accessPayload = buildAccessUpdatePayload(team.teamId, team.access)
        await service.addMemberToTeam(member.id, team.teamId, accessPayload)
      }

      for (const team of pendingUpdates) {
        const accessPayload = buildAccessUpdatePayload(team.teamId, team.access)
        await service.updateMember(member.id, accessPayload)
      }

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
          <div className="overflow-y-auto flex-1 flex flex-col gap-5 pr-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-fullName">Nome completo</Label>
              <Input
                id="member-fullName"
                value={profileForm.fullName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Nome do membro"
                disabled={isSubmitting}
              />
              {profileForm.fullName.length > 0 && !nameValid && (
                <p className="text-xs text-destructive">Mínimo de 2 caracteres</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="member-phone">Telefone</Label>
                <Input
                  id="member-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={maskPhone(profileForm.phone)}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      phone: unmask(maskPhone(event.target.value)),
                    }))
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="member-email">E-mail</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  disabled={isSubmitting}
                />
                {profileForm.email.length > 0 && !emailValid && (
                  <p className="text-xs text-destructive">E-mail inválido</p>
                )}
              </div>
            </div>

            {details?.id ? (
              <BackofficeMemberTeamAccordions
                key={`${member.id}-${isLoadingTeams ? "loading" : "ready"}`}
                teams={teamsDraft}
                onTeamsChange={setTeamsDraft}
                memberIsMaster={member.isMaster}
                canManage={canManage}
                isSubmitting={isSubmitting}
                isLoading={isLoadingTeams}
                externalTeams={externalTeams}
                defaultExpandedTeamIds={defaultExpandedTeamIds}
              />
            ) : null}

            {!member.isMaster ? (
              <>
                <Separator />
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex flex-col gap-3">
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
            <Button type="submit" disabled={!isValid || isSubmitting || isLoadingTeams}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
