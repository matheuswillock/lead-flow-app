"use client"

import { ChevronDown, UserMinus, UserPlus } from "lucide-react"
import { useState } from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  FUNCTION_OPTIONS,
  ROLE_OPTIONS,
  defaultOperatorAccess,
  normalizeAccessForRole,
  type MemberFunction,
  type MemberRole,
  type TeamAccessFormState,
  type TeamMembershipDraft,
} from "../utils/memberTeamAccessUtils"

export interface ExternalTeamMembershipRow {
  teamId: string
  teamName: string
  accountMasterId: string
  accountName: string
  role: string
}

interface BackofficeMemberTeamAccordionsProps {
  teams: Record<string, TeamMembershipDraft>
  onTeamsChange: (teams: Record<string, TeamMembershipDraft>) => void
  memberIsMaster: boolean
  canManage: boolean
  isSubmitting: boolean
  isLoading: boolean
  externalTeams?: ExternalTeamMembershipRow[]
  defaultExpandedTeamIds?: string[]
}

function TeamAccessFields({
  access,
  onChange,
  disabled,
}: {
  access: TeamAccessFormState
  onChange: (next: TeamAccessFormState) => void
  disabled: boolean
}) {
  function patchAccess(partial: Partial<TeamAccessFormState>) {
    onChange(normalizeAccessForRole({ ...access, ...partial }))
  }

  function setRole(role: MemberRole) {
    onChange(normalizeAccessForRole({ ...access, role }))
  }

  function toggleFunction(fn: MemberFunction) {
    const functions = access.functions.includes(fn)
      ? access.functions.filter((value) => value !== fn)
      : [...access.functions, fn]
    onChange(normalizeAccessForRole({ ...access, functions }))
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
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
                aria-label={item.label}
                checked={access.role === item.value}
                onCheckedChange={() => setRole(item.value)}
                disabled={disabled}
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
                aria-label={item.label}
                checked={access.functions.includes(item.value)}
                onCheckedChange={() => toggleFunction(item.value)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>

      {access.role === "manager" ? (
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
              aria-label="Pode cadastrar novos usuários"
              checked={access.canCreateAccountUsers}
              onCheckedChange={(checked) => patchAccess({ canCreateAccountUsers: checked })}
              disabled={disabled}
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
              aria-label="Pode gerenciar times"
              checked={access.canManageAccountTeams}
              onCheckedChange={(checked) => patchAccess({ canManageAccountTeams: checked })}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

      {access.role === "manager" || access.role === "backoffice" ? (
        <div className="flex flex-col gap-3">
          {access.role === "backoffice" ? (
            <div>
              <p className="text-sm font-medium">Permissões delegadas</p>
              <p className="text-xs text-muted-foreground">
                Essas permissões adicionais só podem ser atribuídas pelo master da conta.
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Pode transferir leads entre times</span>
              <span className="text-xs text-muted-foreground">
                Permite repassar leads para outro time da conta neste time.
              </span>
            </div>
            <Switch
              aria-label="Pode transferir leads entre times"
              checked={access.canTransferAccountLeads}
              onCheckedChange={(checked) => patchAccess({ canTransferAccountLeads: checked })}
              disabled={disabled}
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
              aria-label="Pode visualizar todos os times"
              checked={access.canViewAllTeams}
              onCheckedChange={(checked) => patchAccess({ canViewAllTeams: checked })}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Alterna a membership do time no draft. Desfazer uma adição ou uma remoção
 * pendente volta ao estado original; adicionar parte de um acesso de operator.
 */
function nextMembershipDraft(current: TeamMembershipDraft): TeamMembershipDraft {
  if (current.isPendingAdd) {
    return {
      ...current,
      isMember: false,
      isPendingAdd: false,
      access: defaultOperatorAccess(),
      originalAccess: undefined,
    }
  }

  if (current.isPendingRemove) {
    return { ...current, isMember: true, isPendingRemove: false }
  }

  if (current.isMember) {
    return { ...current, isMember: false, isPendingRemove: true }
  }

  return {
    ...current,
    isMember: true,
    isPendingAdd: true,
    isPendingRemove: false,
    access: defaultOperatorAccess(),
    originalAccess: undefined,
  }
}

export function BackofficeMemberTeamAccordions({
  teams,
  onTeamsChange,
  memberIsMaster,
  canManage,
  isSubmitting,
  isLoading,
  externalTeams = [],
  defaultExpandedTeamIds = [],
}: BackofficeMemberTeamAccordionsProps) {
  const teamList = Object.values(teams).sort((a, b) => a.teamName.localeCompare(b.teamName))
  // O estado inicial é semeado pelo remount que `BackofficeMemberEditDialog`
  // força via `key` quando o fetch dos times termina — não há segunda
  // estratégia de inicialização aqui.
  const [openTeamIds, setOpenTeamIds] = useState<string[]>(defaultExpandedTeamIds)

  function updateTeam(teamId: string, updater: (current: TeamMembershipDraft) => TeamMembershipDraft) {
    const current = teams[teamId]
    if (!current) return
    onTeamsChange({ ...teams, [teamId]: updater(current) })
  }

  function handleToggleMembership(teamId: string) {
    if (!canManage || isSubmitting || memberIsMaster) return

    const current = teams[teamId]
    if (!current) return

    const next = nextMembershipDraft(current)
    onTeamsChange({ ...teams, [teamId]: next })

    // O painel de permissões só existe enquanto a membership resultante está
    // ativa (mesmo predicado de `isExpandable`). Uma decisão só, no fim — três
    // `setOpenTeamIds` concorrentes na mesma fila se anulavam entre si.
    const shouldStayOpen = next.isMember && !next.isPendingRemove
    setOpenTeamIds((previous) => {
      const withoutTeam = previous.filter((id) => id !== teamId)
      return shouldStayOpen ? [...withoutTeam, teamId] : withoutTeam
    })
  }

  return (
    <>
      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium">Times deste cliente</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure permissões por time. Alterações só são aplicadas ao salvar.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : teamList.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Este cliente ainda não possui times cadastrados.
          </p>
        ) : (
          <Accordion
            type="multiple"
            value={openTeamIds}
            onValueChange={setOpenTeamIds}
            className="rounded-md border"
          >
            {teamList.map((team) => {
              const isExpandable = team.isMember && !team.isPendingRemove
              const actionDisabled = !canManage || isSubmitting || (team.isMember && memberIsMaster)

              return (
                <AccordionItem key={team.teamId} value={team.teamId} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <AccordionPrimitive.Header className="flex flex-1 min-w-0">
                      <AccordionPrimitive.Trigger
                        disabled={!isExpandable}
                        className={cn(
                          "flex flex-1 items-center gap-2 text-left text-sm font-medium transition-all min-w-0",
                          isExpandable
                            ? "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]>svg]:rotate-180"
                            : "cursor-default opacity-70"
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                            !isExpandable && "opacity-40"
                          )}
                        />
                        <span className="truncate">{team.teamName}</span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          {team.membersCount} membro{team.membersCount === 1 ? "" : "s"}
                        </span>
                        {team.isPendingAdd ? <Badge variant="secondary">Novo</Badge> : null}
                        {team.isPendingRemove ? (
                          <Badge variant="outline">Remoção pendente</Badge>
                        ) : null}
                      </AccordionPrimitive.Trigger>
                    </AccordionPrimitive.Header>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleToggleMembership(team.teamId)
                      }}
                      disabled={actionDisabled}
                      title={
                        memberIsMaster && team.isMember
                          ? "Não é possível remover o usuário master do time"
                          : team.isPendingRemove
                            ? "Desfazer a remoção deste time"
                            : team.isMember
                              ? "Remover deste time"
                              : team.isPendingAdd
                                ? "Desfazer a adição a este time"
                                : "Adicionar a este time"
                      }
                    >
                      {/* `isPendingRemove` zera `isMember`, então a checagem
                          precisa vir antes — senão o desfazer da remoção
                          aparece como "Adicionar". */}
                      {team.isPendingRemove ? (
                        <>
                          <UserPlus data-icon="inline-start" />
                          Desfazer
                        </>
                      ) : team.isMember ? (
                        <>
                          <UserMinus data-icon="inline-start" />
                          Remover
                        </>
                      ) : team.isPendingAdd ? (
                        <>
                          <UserMinus data-icon="inline-start" />
                          Desfazer
                        </>
                      ) : (
                        <>
                          <UserPlus data-icon="inline-start" />
                          Adicionar
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Mesmo predicado do trigger (`isExpandable`): condição
                      diferente aqui deixa o accordion abrir vazio. Se algum
                      caso precisar bloquear a expansão, bloqueie em
                      `isExpandable`, nunca só no render do conteúdo. */}
                  {isExpandable ? (
                    <AccordionContent className="px-3 pb-4">
                      <TeamAccessFields
                        access={team.access}
                        onChange={(access) =>
                          updateTeam(team.teamId, (current) => ({ ...current, access }))
                        }
                        disabled={isSubmitting}
                      />
                    </AccordionContent>
                  ) : null}
                </AccordionItem>
              )
            })}
          </Accordion>
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
