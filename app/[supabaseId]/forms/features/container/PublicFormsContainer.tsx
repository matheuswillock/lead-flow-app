"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Archive, BarChart3, Copy, Ellipsis, FileText, Plus, Settings } from "lucide-react"
import { toast } from "sonner"
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { ManagedByCorretorStudioBadge } from "@/components/email/ManagedByCorretorStudioBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  PUBLIC_FORM_TEMPLATE_IDS,
  isTeamAllowedForPublicFormTemplate,
} from "@/lib/public-forms/templates-access"
import { usePublicForms } from "../context/PublicFormsContext"
import type {
  PublicFormListItem,
  PublicFormSettings,
  PublicFormsIds,
} from "../context/PublicFormsTypes"
import { publicFormsClientService } from "../services/PublicFormsService"

const statusLabel = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" }
const approvalLabel = {
  draft: "—",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Reprovado",
}

type Member = { profileId: string; name: string; functions: string[] }

export function PublicFormsContainer() {
  const params = useParams<{ supabaseId: string }>()
  const forms = usePublicForms()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyticsId, setAnalyticsId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<PublicFormListItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PublicFormListItem | null>(null)
  const [rejectComment, setRejectComment] = useState("")
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!forms.ids) return
    void fetch(`/api/v1/teams/${forms.ids.teamId}/members?function=SDR`, {
      headers: {
        "x-supabase-user-id": forms.ids.supabaseId,
        "x-team-id": forms.ids.teamId,
      },
    })
      .then((response) => response.json())
      .then((output) =>
        setMembers(Array.isArray(output.result?.members) ? output.result.members : []),
      )
      .catch(() => setMembers([]))
  }, [forms.ids])

  const hasFilters =
    Boolean(forms.search) ||
    forms.status.length > 0 ||
    forms.approval.length > 0 ||
    forms.sdrIds.length > 0 ||
    Boolean(forms.dateRange)

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formulários públicos</h1>
          <p className="text-sm text-muted-foreground">
            Crie experiências de captação e qualificação para seu time.
          </p>
        </div>
        {forms.capabilities.canEdit ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings data-icon="inline-start" />
              Configurações
            </Button>
            <Button asChild>
              <Link href={`/${params.supabaseId}/forms/new`}>
                <Plus data-icon="inline-start" />
                Criar formulário
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {forms.capabilities.canEdit ? (
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <div>
            <h2 className="text-sm font-semibold">Templates</h2>
            <p className="text-xs text-muted-foreground">
              Comece do zero ou use um modelo pronto.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={`/${params.supabaseId}/forms/new?template=${PUBLIC_FORM_TEMPLATE_IDS.HEALTH_PLAN_SIMULATOR}`}
              className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <span className="font-medium">Simulador de Redução</span>
              <span className="text-xs text-muted-foreground">
                Modelo com capa, perguntas, cálculo de economia e agendamento.
              </span>
            </Link>
            {isTeamAllowedForPublicFormTemplate(
              PUBLIC_FORM_TEMPLATE_IDS.PROFESSION_HEALTH_PLAN,
              forms.ids?.teamId,
            ) ? (
              <Link
                href={`/${params.supabaseId}/forms/new?template=${PUBLIC_FORM_TEMPLATE_IDS.PROFESSION_HEALTH_PLAN}`}
                className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <span className="font-medium">Formulário básico</span>
                <span className="text-xs text-muted-foreground">
                  Modelo exclusivo com capa, qualificação e captura de leads.
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <LeadsFiltersLayout
        actions={
          hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                forms.setSearch("")
                forms.setStatus([])
                forms.setApproval([])
                forms.setSdrIds([])
                forms.setDateRange(undefined)
                forms.setPage(1)
              }}
            >
              Limpar filtros
            </Button>
          ) : null
        }
      >
        <Input
          className="h-8 w-full sm:w-72"
          placeholder="Buscar formulário"
          value={forms.search}
          onChange={(event) => {
            forms.setSearch(event.target.value)
            forms.setPage(1)
          }}
        />
        <LeadsMultiFilter
          title="Estado"
          options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))}
          selectedValues={forms.status}
          onChange={(value) => {
            forms.setStatus(value)
            forms.setPage(1)
          }}
        />
        <LeadsMultiFilter
          title="Aprovação"
          options={Object.entries(approvalLabel).map(([value, label]) => ({ value, label }))}
          selectedValues={forms.approval}
          onChange={(value) => {
            forms.setApproval(value)
            forms.setPage(1)
          }}
        />
        <LeadsMultiFilter
          title="SDR responsável"
          options={members.map((member) => ({ value: member.profileId, label: member.name }))}
          selectedValues={forms.sdrIds}
          onChange={(value) => {
            forms.setSdrIds(value.slice(-1))
            forms.setPage(1)
          }}
        />
        <LeadsDateFilter
          title="Atualizado em"
          value={forms.dateRange}
          onChange={(value) => {
            forms.setDateRange(value)
            forms.setPage(1)
          }}
        />
      </LeadsFiltersLayout>

      {forms.error ? (
        <Alert variant="destructive">
          <AlertDescription>{forms.error}</AlertDescription>
        </Alert>
      ) : null}

      {forms.loading ? (
        <div className="space-y-2" aria-label="Carregando formulários">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-14 w-full" />
          ))}
        </div>
      ) : forms.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Nenhum formulário encontrado</EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Ajuste os filtros para encontrar outros formulários."
                : "Comece com um formulário de captação e publique quando estiver pronto."}
            </EmptyDescription>
          </EmptyHeader>
          {!hasFilters && forms.capabilities.canEdit ? (
            <EmptyContent>
              <Button asChild>
                <Link href={`/${params.supabaseId}/forms/new`}>
                  <Plus data-icon="inline-start" />
                  Criar primeiro formulário
                </Link>
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Aprovação</TableHead>
                <TableHead className="hidden lg:table-cell">SDR</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead className="hidden sm:table-cell">Atualizado</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      {forms.capabilities.canEdit ? (
                        <Link
                          className="hover:underline"
                          href={`/${params.supabaseId}/forms/${item.id}`}
                        >
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
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
                  <TableCell className="hidden lg:table-cell">
                    {item.assignedSdr?.fullName || "—"}
                  </TableCell>
                  <TableCell className="text-right">{item._count.submissions}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                      new Date(item.updatedAt),
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Ações de ${item.name}`}>
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {forms.capabilities.canEdit ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/${params.supabaseId}/forms/${item.id}`}>Editar</Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem asChild>
                          <Link href={`/${params.supabaseId}/forms/${item.id}?preview=1`}>
                            Preview
                          </Link>
                        </DropdownMenuItem>
                        {item.status === "published" ? (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(`${window.location.origin}/forms/${item.publicId}`)
                                  .then(() => toast.success("Link copiado"))
                              }
                            >
                              <Copy /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(
                                    `<iframe src="${window.location.origin}/forms/${item.publicId}" width="100%" height="720" frameborder="0"></iframe>`,
                                  )
                                  .then(() => toast.success("Iframe copiado"))
                              }
                            >
                              Copiar iframe
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuItem onClick={() => setAnalyticsId(item.id)}>
                          <BarChart3 /> Métricas
                        </DropdownMenuItem>
                        {forms.capabilities.canEdit ? (
                          <DropdownMenuItem onClick={() => void forms.action(item.id, "duplicate")}>
                            Duplicar
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {forms.capabilities.canApprove && item.approvalStatus === "pending_approval" ? (
                          <>
                            <DropdownMenuItem onClick={() => void forms.action(item.id, "approve")}>
                              Aprovar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRejectTarget(item)}>
                              Reprovar
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {forms.capabilities.canEdit && item.status !== "archived" && item.status !== "published" ? (
                          <DropdownMenuItem
                            onClick={() => void forms.action(item.id, "submit-approval")}
                          >
                            Solicitar aprovação
                          </DropdownMenuItem>
                        ) : null}
                        {(forms.capabilities.canEdit || forms.capabilities.canApprove) && item.status !== "archived" ? (
                          <DropdownMenuItem onClick={() => void forms.action(item.id, "publish")}>
                            Publicar
                          </DropdownMenuItem>
                        ) : forms.capabilities.canEdit ? (
                          <DropdownMenuItem onClick={() => void forms.action(item.id, "restore")}>
                            Restaurar para rascunho
                          </DropdownMenuItem>
                        ) : null}
                        {forms.capabilities.canEdit && item.status !== "archived" ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setArchiveTarget(item)}
                          >
                            <Archive /> Arquivar
                          </DropdownMenuItem>
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

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">{forms.total} formulário(s)</span>
        <Button
          variant="outline"
          size="sm"
          disabled={forms.page <= 1}
          onClick={() => forms.setPage(forms.page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={forms.page >= forms.totalPages}
          onClick={() => forms.setPage(forms.page + 1)}
        >
          Próxima
        </Button>
      </div>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} ids={forms.ids} />
      <AnalyticsDialog
        id={analyticsId}
        onOpenChange={(open) => !open && setAnalyticsId(null)}
        ids={forms.ids}
      />
      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              O link público será desativado, mas respostas e publicações serão preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) void forms.action(archiveTarget.id, "archive")
                setArchiveTarget(null)
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectComment("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar formulário</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="public-form-rejection">Comentário obrigatório</Label>
            <Textarea
              id="public-form-rejection"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Explique o que precisa ser ajustado"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!rejectComment.trim()}
              onClick={() => {
                if (rejectTarget)
                  void forms.action(rejectTarget.id, "reject", { comment: rejectComment })
                setRejectTarget(null)
                setRejectComment("")
              }}
            >
              Reprovar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function SettingsSheet({
  open,
  onOpenChange,
  ids,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  ids: PublicFormsIds | null
}) {
  const [draft, setDraft] = useState<PublicFormSettings | null>(null)
  const [initial, setInitial] = useState<PublicFormSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty = Boolean(draft && initial && JSON.stringify(draft) !== JSON.stringify(initial))

  useEffect(() => {
    if (!open || !ids) return
    void publicFormsClientService
      .getSettings(ids)
      .then((value) => {
        setDraft(value)
        setInitial(value)
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Erro ao carregar"))
  }, [ids, open])

  function requestOpenChange(next: boolean) {
    if (!next && dirty) {
      setConfirmClose(true)
      return
    }
    onOpenChange(next)
  }

  async function save() {
    if (!draft || !ids) return
    if (draft.approvalRequired && draft.approverRoles.length === 0) {
      toast.error("Selecione ao menos uma role aprovadora")
      return
    }
    setSaving(true)
    try {
      const saved = await publicFormsClientService.saveSettings(ids, draft)
      setInitial(saved)
      setDraft(saved)
      toast.success("Configurações salvas")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestOpenChange}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Configurações dos formulários</SheetTitle>
            <SheetDescription>
              Defina a governança e o estilo herdado pelos formulários do time.
            </SheetDescription>
          </SheetHeader>
          {!draft ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="flex-1 space-y-8 overflow-y-auto py-4">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Exigir aprovação</Label>
                    <p className="text-sm text-muted-foreground">
                      Bloqueia a publicação até a revisão.
                    </p>
                  </div>
                  <Switch
                    checked={draft.approvalRequired}
                    onCheckedChange={(approvalRequired) => setDraft({ ...draft, approvalRequired })}
                  />
                </div>
                {(["manager", "backoffice", "operator"] as const).map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.approverRoles.includes(role)}
                      onCheckedChange={(checked) =>
                        setDraft({
                          ...draft,
                          approverRoles: checked
                            ? [...new Set([...draft.approverRoles, role])]
                            : draft.approverRoles.filter((item) => item !== role),
                        })
                      }
                    />
                    {role === "manager"
                      ? "Manager"
                      : role === "backoffice"
                        ? "Backoffice"
                        : "Operador"}
                  </label>
                ))}
              </section>
              <section className="space-y-4">
                <div>
                  <Label>Estilo padrão</Label>
                  <p className="text-sm text-muted-foreground">
                    Aplicado enquanto o formulário herdar o tema do time.
                  </p>
                </div>
                {[
                  ["Fundo", "defaultBackgroundColor"],
                  ["Texto", "defaultTextColor"],
                  ["Linhas e opções", "defaultLineColor"],
                  ["Destaque (botões / progresso)", "defaultAccentColor"],
                  ["Texto do botão", "defaultButtonTextColor"],
                  ["Fundo do input", "defaultInputBackgroundColor"],
                ].map(([label, key]) => (
                  <div className="flex items-center justify-between" key={key}>
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="color"
                      className="h-9 w-20 p-1"
                      value={draft[key as keyof PublicFormSettings] as string}
                      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                    />
                  </div>
                ))}
                <div
                  className="rounded-lg border p-5"
                  style={{
                    backgroundColor: draft.defaultBackgroundColor,
                    color: draft.defaultTextColor,
                    borderColor: draft.defaultLineColor,
                  }}
                >
                  <p className="font-medium">Prévia do formulário</p>
                  <div
                    className="mt-3 rounded-md border p-3"
                    style={{ borderColor: draft.defaultLineColor }}
                  >
                    Uma opção de resposta
                  </div>
                </div>
              </section>
            </div>
          )}
          <SheetFooter>
            <Button variant="outline" onClick={() => requestOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || !draft || !dirty} onClick={() => void save()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As configurações modificadas não serão salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false)
                setDraft(initial)
                onOpenChange(false)
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AnalyticsDialog({
  id,
  onOpenChange,
  ids,
}: {
  id: string | null
  onOpenChange: (value: boolean) => void
  ids: PublicFormsIds | null
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof publicFormsClientService.analytics>
  > | null>(null)
  const [publicationId, setPublicationId] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id || !ids) return
    setLoading(true)
    void publicFormsClientService
      .analytics(ids, id, {
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        publicationId,
      })
      .then(setData)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar métricas"),
      )
      .finally(() => setLoading(false))
  }, [from, id, ids, publicationId, to])

  const events = useMemo(
    () =>
      (data?.events ?? []).filter(
        (event) => publicationId === "all" || event.publicationId === publicationId,
      ),
    [data, publicationId],
  )
  const count = (type: string) =>
    events
      .filter((event) => event.eventType === type)
      .reduce((sum, event) => sum + event._count._all, 0)
  const views = count("form_viewed")
  const starts = count("form_started")
  const completions = count("form_completed")
  const questions = useMemo(
    () =>
      (data?.publications ?? [])
        .filter((publication) =>
          publicationId === "all" ? true : publication.id === publicationId,
        )
        .flatMap((publication) =>
          publication.questions.map((question) => ({
            ...question,
            publicationId: publication.id,
            version: publication.version,
          })),
        ),
    [data, publicationId],
  )

  return (
    <Dialog open={Boolean(id)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Métricas do formulário</DialogTitle>
        </DialogHeader>
        {loading || !data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-end gap-2">
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="Data inicial das métricas"
                className="w-40"
              />
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="Data final das métricas"
                className="w-40"
              />
              <Select value={publicationId} onValueChange={setPublicationId}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as publicações</SelectItem>
                  {data.publications.map((publication) => (
                    <SelectItem key={publication.id} value={publication.id}>
                      Versão {publication.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["Visualizações", views],
                ["Inícios", starts],
                ["Conclusões", completions],
                ["Conversão", views ? `${((completions / views) * 100).toFixed(1)}%` : "0%"],
                ["Leads", count("lead_created") + count("lead_attached")],
                ["Agendamentos", count("meeting_scheduled")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <Tabs defaultValue="overview">
              <TabsList className="flex-wrap">
                <TabsTrigger value="overview">Visão geral</TabsTrigger>
                <TabsTrigger value="funnel">Funil e abandono</TabsTrigger>
                <TabsTrigger value="publications">Publicações</TabsTrigger>
                <TabsTrigger value="origin">Origem</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="flex flex-col gap-4 rounded-lg border p-4">
                {views === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum dado no período selecionado.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Funil resumido</p>
                      {[
                        ["Visualizações", views],
                        ["Inícios", starts],
                        ["Conclusões", completions],
                        ["Leads", count("lead_created") + count("lead_attached")],
                        ["Agendamentos", count("meeting_scheduled")],
                      ].map(([label, value]) => {
                        const numeric = Number(value)
                        const width = views > 0 ? Math.max(4, Math.round((numeric / views) * 100)) : 0
                        return (
                          <div key={String(label)} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span>{label}</span>
                              <span className="font-medium tabular-nums">{value}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Conversão (conclusão)</p>
                          <p className="mt-1 text-lg font-semibold">
                            {views ? `${((completions / views) * 100).toFixed(1)}%` : "0%"}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Início → conclusão</p>
                          <p className="mt-1 text-lg font-semibold">
                            {starts ? `${((completions / starts) * 100).toFixed(1)}%` : "0%"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Destaques</p>
                      <p className="text-sm text-muted-foreground">
                        {
                          data.publications.filter((publication) => !publication.endedAt).length
                        }{" "}
                        ativas ·{" "}
                        {
                          data.publications.filter((publication) => publication.endedAt).length
                        }{" "}
                        encerradas
                      </p>
                      {(data.origins ?? []).slice(0, 3).length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-muted-foreground">Top origens</p>
                          {(data.origins ?? []).slice(0, 3).map((origin) => (
                            <div
                              key={origin.source}
                              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                            >
                              <span className="truncate">{origin.source}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {origin.sessions} sessão{origin.sessions === 1 ? "" : "ões"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma origem registrada no período.
                        </p>
                      )}
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  O resumo considera sessões e eventos anônimos da publicação selecionada.
                </p>
              </TabsContent>
              <TabsContent value="funnel" className="space-y-2">
                {questions.map((question) => {
                  const questionEvents = events.filter(
                    (event) =>
                      event.publicationId === question.publicationId &&
                      event.questionId === question.id,
                  )
                  const metric = (type: string) =>
                    questionEvents
                      .filter((event) => event.eventType === type)
                      .reduce((sum, event) => sum + event._count._all, 0)
                  const viewed = metric("question_viewed")
                  const answered = metric("question_answered")
                  const skipped = metric("question_skipped")
                  const notDisplayed = Math.max(0, starts - viewed - skipped)
                  const abandonment = Math.max(0, viewed - answered)
                  return (
                    <div
                      key={`${question.publicationId}:${question.id}`}
                      className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]"
                    >
                      <span>
                        v{question.version} · {question.title}
                      </span>
                      <span>
                        {answered}/{viewed} respostas
                      </span>
                      <span>{abandonment} abandonos</span>
                      <span>{notDisplayed} não exibidas</span>
                    </div>
                  )
                })}
              </TabsContent>
              <TabsContent value="publications">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Publicada em</TableHead>
                      <TableHead>Vigência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.publications.map((publication) => (
                      <TableRow key={publication.id}>
                        <TableCell>v{publication.version}</TableCell>
                        <TableCell>
                          {new Date(publication.publishedAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{publication.endedAt ? "Encerrada" : "Atual"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="origin" className="space-y-2">
                {data.origins.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    Nenhuma origem registrada no período.
                  </div>
                ) : (
                  data.origins.map((origin) => (
                    <div
                      key={origin.source}
                      className="flex justify-between rounded-lg border p-3 text-sm"
                    >
                      <span>{origin.source}</span>
                      <span>{origin.sessions} sessões</span>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
