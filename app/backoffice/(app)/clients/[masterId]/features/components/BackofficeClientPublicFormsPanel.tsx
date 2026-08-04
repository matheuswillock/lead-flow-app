"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Archive,
  BarChart3,
  Copy,
  Ellipsis,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react"
import { toast } from "sonner"
import { ManagedByCorretorStudioBadge } from "@/components/email/ManagedByCorretorStudioBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { backofficeStudioPublicFormsService } from "../services/BackofficeStudioPublicFormsService"
import type {
  StudioPublicFormAnalytics,
  StudioPublicFormListItem,
  StudioPublicFormSettings,
} from "../services/IBackofficeStudioPublicFormsService"

type TeamOption = { id: string; name: string }

type Props = {
  masterId: string
  teams: TeamOption[]
  selectedTeamId: string | null
  onSelectedTeamIdChange: (teamId: string | null) => void
  canManage: boolean
}

const statusLabel = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" } as const
const approvalLabel = {
  draft: "Rascunho",
  pending_approval: "Aguardando",
  approved: "Aprovado",
  rejected: "Reprovado",
} as const

export function BackofficeClientPublicFormsPanel({
  masterId,
  teams,
  selectedTeamId,
  onSelectedTeamIdChange,
  canManage,
}: Props) {
  const teamId = selectedTeamId
  const [items, setItems] = useState<StudioPublicFormListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [actionId, setActionId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<StudioPublicFormSettings | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsForm, setAnalyticsForm] = useState<StudioPublicFormListItem | null>(null)
  const [analytics, setAnalytics] = useState<StudioPublicFormAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const inFlightKey = useRef<string | null>(null)
  const lastSuccessKey = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedTeamId && teams[0]?.id) {
      onSelectedTeamIdChange(teams[0].id)
    }
  }, [selectedTeamId, teams, onSelectedTeamIdChange])

  const loadForms = useCallback(async () => {
    if (!teamId) return
    const key = `${masterId}:${teamId}:${search}:${statusFilter}`
    if (inFlightKey.current === key) return
    inFlightKey.current = key
    setLoading(true)
    try {
      const result = await backofficeStudioPublicFormsService.list(masterId, teamId, {
        search: search.trim() || undefined,
        status: statusFilter === "all" ? undefined : [statusFilter],
        page: 1,
        pageSize: 50,
      })
      setItems(result.items)
      lastSuccessKey.current = key
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar formulários")
    } finally {
      if (inFlightKey.current === key) inFlightKey.current = null
      setLoading(false)
    }
  }, [masterId, search, statusFilter, teamId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadForms(), 250)
    return () => window.clearTimeout(timeout)
  }, [loadForms])

  async function runAction(formId: string, action: string, body?: unknown) {
    if (!teamId || actionId) return
    setActionId(`${formId}:${action}`)
    try {
      await backofficeStudioPublicFormsService.action(masterId, teamId, formId, action, body)
      toast.success("Ação concluída")
      await loadForms()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir")
    } finally {
      setActionId(null)
    }
  }

  async function openSettings() {
    if (!teamId) return
    try {
      const result = await backofficeStudioPublicFormsService.getSettings(masterId, teamId)
      setSettings(result)
      setSettingsOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar configurações")
    }
  }

  async function saveSettings() {
    if (!teamId || !settings || settingsSaving) return
    setSettingsSaving(true)
    try {
      const result = await backofficeStudioPublicFormsService.saveSettings(
        masterId,
        teamId,
        settings
      )
      setSettings(result)
      toast.success("Configurações salvas")
      setSettingsOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSettingsSaving(false)
    }
  }

  async function openAnalytics(form: StudioPublicFormListItem) {
    if (!teamId) return
    setAnalyticsForm(form)
    setAnalyticsOpen(true)
    setAnalyticsLoading(true)
    try {
      const result = await backofficeStudioPublicFormsService.analytics(masterId, teamId, form.id)
      setAnalytics(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar métricas")
      setAnalytics(null)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-56">
          <FieldLabel>Time</FieldLabel>
          <Select
            value={selectedTeamId ?? ""}
            onValueChange={(value) => onSelectedTeamIdChange(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um time" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="min-w-48 flex-1">
          <FieldLabel>Buscar</FieldLabel>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome do formulário"
          />
        </Field>
        <Field className="min-w-40">
          <FieldLabel>Status</FieldLabel>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadForms()}
            disabled={!teamId || loading}
          >
            {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            Atualizar
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => void openSettings()} disabled={!teamId}>
                <Settings data-icon="inline-start" />
                Configurações
              </Button>
              <Button type="button" size="sm" asChild disabled={!teamId}>
                <Link href={`/backoffice/clients/${masterId}/forms/new?teamId=${teamId}`}>
                  <Plus data-icon="inline-start" />
                  Novo formulário
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Formulários do time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!teamId ? (
            <p className="text-sm text-muted-foreground">Selecione um time para gerenciar formulários.</p>
          ) : loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum formulário encontrado neste time.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Aprovação</TableHead>
                    <TableHead className="text-right">Respostas</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="font-medium hover:underline"
                            href={`/backoffice/clients/${masterId}/forms/${item.id}?teamId=${teamId}`}
                          >
                            {item.name}
                          </Link>
                          {item.managedByCorretorStudio ? <ManagedByCorretorStudioBadge /> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "published" ? "default" : "secondary"}>
                          {statusLabel[item.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {approvalLabel[item.approvalStatus]}
                      </TableCell>
                      <TableCell className="text-right">{item._count.submissions}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ações de ${item.name}`}
                              disabled={Boolean(actionId)}
                            >
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/backoffice/clients/${masterId}/forms/${item.id}?teamId=${teamId}`}
                              >
                                Editar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openAnalytics(item)}>
                              <BarChart3 data-icon="inline-start" />
                              Métricas
                            </DropdownMenuItem>
                            {canManage ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => void runAction(item.id, "duplicate")}
                                >
                                  <Copy data-icon="inline-start" />
                                  Duplicar
                                </DropdownMenuItem>
                                {item.status !== "published" ? (
                                  <DropdownMenuItem
                                    onClick={() => void runAction(item.id, "publish")}
                                  >
                                    Publicar
                                  </DropdownMenuItem>
                                ) : null}
                                {item.status !== "archived" ? (
                                  <DropdownMenuItem
                                    onClick={() => void runAction(item.id, "archive")}
                                  >
                                    <Archive data-icon="inline-start" />
                                    Arquivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => void runAction(item.id, "restore")}
                                  >
                                    Restaurar
                                  </DropdownMenuItem>
                                )}
                                {item.approvalStatus === "pending_approval" ? (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => void runAction(item.id, "approve")}
                                    >
                                      Aprovar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        void runAction(item.id, "reject", {
                                          comment: "Reprovado pelo Corretor Studio",
                                        })
                                      }
                                    >
                                      Reprovar
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Configurações de formulários</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {settings ? (
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldLabel>Exigir aprovação antes de publicar</FieldLabel>
                  <Switch
                    checked={settings.approvalRequired}
                    onCheckedChange={(checked) =>
                      setSettings((current) =>
                        current ? { ...current, approvalRequired: checked } : current
                      )
                    }
                  />
                </Field>
              </FieldGroup>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void saveSettings()} disabled={settingsSaving}>
              {settingsSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Métricas — {analyticsForm?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {analyticsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : analytics ? (
              <div className="flex flex-col gap-3 text-sm">
                <p>
                  Publicações: <strong>{analytics.publications.length}</strong>
                </p>
                <p>
                  Eventos registrados: <strong>{analytics.events.length}</strong>
                </p>
                <p>
                  Origens: <strong>{analytics.origins.length}</strong>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de métricas.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
