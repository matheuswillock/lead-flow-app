"use client"

import { useEffect, useState } from "react"
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { useBackofficeTeamEmailLimitContext } from "../context/BackofficeTeamEmailLimitContext"
import type {
  SendingHealthAction,
  TeamEmailLimitGrantItem,
  TeamSearchItem,
  TeamSendingHealthItem,
} from "../context/BackofficeTeamEmailLimitTypes"

function formatLimit(maxEmailsPerDay: number | null): string {
  if (maxEmailsPerDay == null) return "Sem limite"
  return `${maxEmailsPerDay.toLocaleString("pt-BR")} / dia`
}

const SENDING_HEALTH_BADGES: Record<
  string,
  { label: string; variant: "outline" | "secondary" | "destructive" }
> = {
  healthy: { label: "Saudável", variant: "outline" },
  warned: { label: "Em alerta", variant: "secondary" },
  paused: { label: "Pausado", variant: "destructive" },
  suspended: { label: "Suspenso", variant: "destructive" },
}

function resolveSendingHealthBadge(health: TeamSendingHealthItem | undefined) {
  return SENDING_HEALTH_BADGES[health?.status ?? "healthy"] ?? SENDING_HEALTH_BADGES.healthy
}

function isSendingBlockedStatus(status: string | undefined): boolean {
  return status === "paused" || status === "suspended"
}

export function BackofficeTeamEmailLimitContainer() {
  const { tz } = useTimezone()
  const {
    grants,
    sendingHealthByTeamId,
    unlistedSendingHealth,
    isLoading,
    error,
    isGranting,
    isRevokingId,
    isApplyingHealthTeamId,
    fetchItems,
    searchTeams,
    grant,
    revoke,
    applySendingHealthAction,
  } = useBackofficeTeamEmailLimitContext()

  const [grantOpen, setGrantOpen] = useState(false)
  const [teamQuery, setTeamQuery] = useState("")
  const [teamResults, setTeamResults] = useState<TeamSearchItem[]>([])
  const [selectedTeam, setSelectedTeam] = useState<TeamSearchItem | null>(null)
  const [isUnlimited, setIsUnlimited] = useState(false)
  const [maxEmailsPerDay, setMaxEmailsPerDay] = useState("5000")
  const [notes, setNotes] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<TeamEmailLimitGrantItem | null>(null)
  // Alvo por teamId, não por grant: time bloqueado SEM limite customizado
  // também precisa da ação de liberar (só o backoffice desfaz `suspended`).
  const [healthActionTarget, setHealthActionTarget] = useState<{
    teamId: string
    teamName: string
    action: SendingHealthAction
  } | null>(null)

  useEffect(() => {
    if (!grantOpen) return
    const trimmed = teamQuery.trim()
    if (trimmed.length < 2) {
      setTeamResults([])
      return
    }

    let cancelled = false

    const timeoutId = window.setTimeout(() => {
      void searchTeams(trimmed)
        .then((results) => {
          if (!cancelled) setTeamResults(results)
        })
        .catch(() => {
          if (!cancelled) setTeamResults([])
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [grantOpen, searchTeams, teamQuery])

  async function handleGrant() {
    if (!selectedTeam) {
      toast.error("Selecione um time")
      return
    }

    const parsedLimit = isUnlimited ? null : Number.parseInt(maxEmailsPerDay, 10)
    if (!isUnlimited && (!Number.isInteger(parsedLimit) || (parsedLimit ?? 0) < 1)) {
      toast.error("Informe um limite diário válido")
      return
    }

    const ok = await grant(selectedTeam.id, parsedLimit, notes.trim() || null)
    if (ok) {
      toast.success("Limite concedido com sucesso")
      setGrantOpen(false)
      setTeamQuery("")
      setTeamResults([])
      setSelectedTeam(null)
      setIsUnlimited(false)
      setMaxEmailsPerDay("5000")
      setNotes("")
    } else {
      toast.error("Não foi possível conceder o limite")
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    const ok = await revoke(revokeTarget.id)
    if (ok) {
      toast.success("Autorização revogada")
      setRevokeTarget(null)
    } else {
      toast.error("Não foi possível revogar a autorização")
    }
  }

  async function handleSendingHealthAction() {
    if (!healthActionTarget) return
    const { teamId, action } = healthActionTarget
    const ok = await applySendingHealthAction(teamId, action)
    if (ok) {
      toast.success(action === "release" ? "Envio liberado" : "Envio pausado")
      setHealthActionTarget(null)
    } else {
      toast.error(
        action === "release" ? "Não foi possível liberar o envio" : "Não foi possível pausar o envio"
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Limites de disparo por time</h1>
          <p className="text-sm text-muted-foreground">
            Whitelist para times com limite diário customizado ou ilimitado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void fetchItems()} disabled={isLoading}>
            <RefreshCw />
            Atualizar
          </Button>
          <Button onClick={() => setGrantOpen(true)}>
            <Plus />
            Adicionar time
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Master</TableHead>
              <TableHead>Limite</TableHead>
              <TableHead>Saúde de envio</TableHead>
              <TableHead>Concedido em</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : grants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum time com limite customizado.
                </TableCell>
              </TableRow>
            ) : (
              grants.map((item) => {
                const health = sendingHealthByTeamId[item.teamId]
                const healthBadge = resolveSendingHealthBadge(health)
                const healthBlocked = isSendingBlockedStatus(health?.status)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.team.name}</TableCell>
                    <TableCell>
                      {item.team.master.fullName?.trim() || item.team.master.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatLimit(item.maxEmailsPerDay)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={healthBadge.variant} title={health?.reason ?? undefined}>
                        {healthBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatIntimezone(new Date(item.grantedAt), "dd/MM/yyyy HH:mm", tz)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{item.notes || "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {healthBlocked ? (
                            <DropdownMenuItem
                              disabled={isApplyingHealthTeamId === item.teamId}
                              onClick={() =>
                                setHealthActionTarget({
                                  teamId: item.teamId,
                                  teamName: item.team.name,
                                  action: "release",
                                })
                              }
                            >
                              Liberar envio
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={isApplyingHealthTeamId === item.teamId}
                              onClick={() =>
                                setHealthActionTarget({
                                  teamId: item.teamId,
                                  teamName: item.team.name,
                                  action: "pause",
                                })
                              }
                            >
                              Pausar envio
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={isRevokingId === item.id}
                            onClick={() => setRevokeTarget(item)}
                          >
                            Revogar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/*
        Segunda tabela, não uma coluna a mais: estes times não têm limite
        customizado, então não existe linha de grant onde caberiam. Sem isso um
        time `suspended` sem grant ficava invisível — e suspensão só sai pelo
        backoffice, ou seja, o suporte não tinha por onde destravar.
      */}
      {!isLoading && unlistedSendingHealth.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-medium">Times sem limite customizado</h3>
            <p className="text-sm text-muted-foreground">
              Fora de &quot;saudável&quot; pela trava de reputação. Suspensão só sai por aqui.
            </p>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Master</TableHead>
                  <TableHead>Saúde de envio</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlistedSendingHealth.map((team) => {
                  const healthBadge = resolveSendingHealthBadge(team)
                  const healthBlocked = isSendingBlockedStatus(team.status)
                  return (
                    <TableRow key={team.teamId}>
                      <TableCell className="font-medium">{team.teamName}</TableCell>
                      <TableCell>{team.masterName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={healthBadge.variant} title={team.reason ?? undefined}>
                          {healthBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {team.changedAt
                          ? formatIntimezone(new Date(team.changedAt), "dd/MM/yyyy HH:mm", tz)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {healthBlocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isApplyingHealthTeamId === team.teamId}
                            onClick={() =>
                              setHealthActionTarget({
                                teamId: team.teamId,
                                teamName: team.teamName,
                                action: "release",
                              })
                            }
                          >
                            Liberar envio
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar time à whitelist</DialogTitle>
            <DialogDescription>
              Conceda limite diário customizado ou marque como sem limite.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Buscar time</FieldLabel>
                <Input
                  value={teamQuery}
                  onChange={(event) => {
                    setTeamQuery(event.target.value)
                    setSelectedTeam(null)
                  }}
                  placeholder="Nome do time, master ou e-mail"
                />
              </Field>
              {teamResults.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-md border p-2">
                  {teamResults.map((team) => (
                    <Button
                      key={team.id}
                      type="button"
                      variant={selectedTeam?.id === team.id ? "secondary" : "ghost"}
                      className="justify-start"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <span className="font-medium">{team.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {team.master.fullName?.trim() || team.master.email}
                      </span>
                    </Button>
                  ))}
                </div>
              ) : null}
              <Field orientation="horizontal">
                <Switch checked={isUnlimited} onCheckedChange={setIsUnlimited} />
                <FieldLabel>Sem limite</FieldLabel>
              </Field>
              {!isUnlimited ? (
                <Field>
                  <FieldLabel>Limite diário</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={maxEmailsPerDay}
                    onChange={(event) => setMaxEmailsPerDay(event.target.value)}
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel>Notas</FieldLabel>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)} disabled={isGranting}>
              Cancelar
            </Button>
            <Button onClick={() => void handleGrant()} disabled={isGranting}>
              {isGranting ? "Salvando..." : "Conceder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar limite customizado?</AlertDialogTitle>
            <AlertDialogDescription>
              O time <strong>{revokeTarget?.team.name}</strong> voltará ao limite padrão de 2.000
              e-mails por dia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRevoke()}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(healthActionTarget)}
        onOpenChange={(open) => !open && setHealthActionTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {healthActionTarget?.action === "release"
                ? "Liberar envio deste time?"
                : "Pausar envio deste time?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {healthActionTarget?.action === "release" ? (
                <>
                  O time <strong>{healthActionTarget?.teamName}</strong> volta ao status
                  de alerta e pode disparar campanhas novamente. A recuperação plena exige 14
                  dias com taxas abaixo do limiar.
                </>
              ) : (
                <>
                  O time <strong>{healthActionTarget?.teamName}</strong> fica impedido de
                  criar e disparar campanhas; partes agendadas serão adiadas com motivo visível.
                  A pausa conta para o gatilho de suspensão (2 pausas em 30 dias).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSendingHealthAction()}>
              {healthActionTarget?.action === "release" ? "Liberar" : "Pausar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
