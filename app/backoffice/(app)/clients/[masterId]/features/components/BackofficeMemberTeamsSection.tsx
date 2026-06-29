"use client"

import { UserMinus, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { BackofficeClientTeamMember } from "../context/BackofficeClientDetailsTypes"

interface TeamRow {
  id: string
  name: string
  membersCount: number
}

export interface ExternalTeamMembershipRow {
  teamId: string
  teamName: string
  accountMasterId: string
  accountName: string
  role: string
}

interface BackofficeMemberTeamsSectionProps {
  teams: TeamRow[]
  memberTeamIds: Set<string>
  member: BackofficeClientTeamMember
  externalTeams?: ExternalTeamMembershipRow[]
  canManage: boolean
  isSubmitting: boolean
  addingTeamId: string | null
  removingTeamId: string | null
  onAddToTeam: (teamId: string) => void
  onRemoveFromTeam: (teamId: string) => void
}

export function BackofficeMemberTeamsSection({
  teams,
  memberTeamIds,
  member,
  externalTeams = [],
  canManage,
  isSubmitting,
  addingTeamId,
  removingTeamId,
  onAddToTeam,
  onRemoveFromTeam,
}: BackofficeMemberTeamsSectionProps) {
  return (
    <>
      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium">Times deste cliente</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adicione ou remova o membro dos times deste cliente.
          </p>
        </div>

        {teams.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Este cliente ainda não possui times cadastrados.
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {teams.map((team) => {
              const isMember = memberTeamIds.has(team.id)
              const isRemoving = removingTeamId === team.id
              const isAdding = addingTeamId === team.id
              const actionDisabled =
                !canManage ||
                isSubmitting ||
                addingTeamId !== null ||
                removingTeamId !== null ||
                (isMember && member.isMaster)

              return (
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
                  {isMember ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveFromTeam(team.id)}
                      disabled={actionDisabled}
                      title={
                        member.isMaster
                          ? "Não é possível remover o usuário master do time"
                          : "Remover deste time"
                      }
                    >
                      <UserMinus data-icon="inline-start" />
                      {isRemoving ? "Removendo..." : "Remover"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddToTeam(team.id)}
                      disabled={actionDisabled}
                      title="Adicionar a este time"
                    >
                      <UserPlus data-icon="inline-start" />
                      {isAdding ? "Adicionando..." : "Adicionar"}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {externalTeams.length > 0 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">Times em outras contas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Memberships cross-account deste usuário em corretoras externas.
              </p>
            </div>
            <div className="rounded-md border divide-y">
              {externalTeams.map((membership) => (
                <div
                  key={`${membership.accountMasterId}-${membership.teamId}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{membership.teamName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {membership.accountName}
                    </p>
                  </div>
                  <Badge variant="secondary">{membership.role}</Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
