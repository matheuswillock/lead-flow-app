"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronDown, Crown, DollarSign, Eye, KeyRound, Mail, MoreHorizontal, Pencil, ShieldCheck, ShieldX, Tag, Trash2, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CircleX, CircleCheckBig } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBackofficeClientDetails } from "../context/BackofficeClientDetailsContext"
import { BackofficeClientEditDialog } from "../components/BackofficeClientEditDialog"
import { BackofficeClientDeleteDialog } from "../components/BackofficeClientDeleteDialog"
import { BackofficeMemberProfileSheet } from "../components/BackofficeMemberProfileSheet"
import { BackofficeMemberEditDialog } from "../components/BackofficeMemberEditDialog"
import { BackofficeMemberDeleteDialog } from "../components/BackofficeMemberDeleteDialog"
import { BackofficeAddMemberDialog } from "../components/BackofficeAddMemberDialog"
import { BackofficeAddTeamDialog } from "../components/BackofficeAddTeamDialog"
import { BackofficeTeamEditDialog } from "../components/BackofficeTeamEditDialog"
import { BackofficeTeamDeleteDialog } from "../components/BackofficeTeamDeleteDialog"
import { BackofficeClientStudioEmailsPanel } from "../components/BackofficeClientStudioEmailsPanel"
import type { BackofficeClientTeam, BackofficeClientTeamMember } from "../context/BackofficeClientDetailsTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, parseDateKeyToUtc } from "@/lib/dates"
import { maskPhone } from "@/lib/masks"
import { cn } from "@/lib/utils"
import {
  MEMBER_PRO_MAX_DAYS,
  memberProExpiresAtFromDays,
} from "../utils/memberProAccessUtils"

const TEAMS_TABLE_GRID = "grid-cols-[2rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem]"

const INVOICE_STATUS_BADGES: Record<
  "paid" | "overdue" | "upcoming" | "other",
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    className?: string
  }
> = {
  paid: {
    label: "Paga",
    variant: "outline",
    className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  },
  overdue: {
    label: "Vencida",
    variant: "outline",
    className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
  },
  upcoming: {
    label: "A vencer",
    variant: "outline",
    className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
  },
  other: { label: "Em processamento", variant: "secondary" },
}

const TEAM_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 30, 40, 50]
const INVOICE_STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "paid", label: "Pagas" },
  { value: "overdue", label: "Vencidas" },
  { value: "upcoming", label: "A vencer" },
] as const
const INVOICE_PERIOD_OPTIONS = [
  { value: "all", label: "Todo período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "this_month", label: "Mês atual" },
] as const

function formatDate(value: string, tz: string) {
  return formatIntimezone(new Date(value), "dd/MM/yyyy", tz)
}

function formatNullableDate(value: string | null, tz: string) {
  if (!value) return "—"
  return formatIntimezone(parseDateKeyToUtc(value, tz), "dd/MM/yyyy", tz)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function getInitials(name: string | null, email: string) {
  const source = (name || email).trim()
  const parts = source.split(" ").filter(Boolean)
  if (parts.length === 0) return "BO"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function BackofficeClientDetailsContainer() {
  const { tz } = useTimezone()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    masterId,
    service,
    canManage,
    details,
    teams,
    teamsPagination,
    invoices,
    invoicesPagination,
    invoiceFilters,
    invoicesSummary,
    isLoading,
    isTeamsLoading,
    isInvoicesLoading,
    error,
    teamsError,
    invoicesError,
    activeSection,
    setActiveSection,
    filters,
    fetchDetails,
    setTeamsPage,
    setTeamsPageSize,
    setInvoicesFilters,
    setInvoicesPage,
    reload,
    clearFilters,
  } = useBackofficeClientDetails()

  const [localFilters, setLocalFilters] = useState(filters)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isTogglingLifetime, setIsTogglingLifetime] = useState(false)
  const [isTogglingMultiskill, setIsTogglingMultiskill] = useState(false)
  const [isTogglingUnlimitedUsers, setIsTogglingUnlimitedUsers] = useState(false)
  const [isTogglingMemberPro, setIsTogglingMemberPro] = useState(false)
  const [memberProDisableOpen, setMemberProDisableOpen] = useState(false)
  const lifetimeInFlight = useRef(false)
  const multiskillInFlight = useRef(false)
  const unlimitedUsersInFlight = useRef(false)
  const memberProInFlight = useRef(false)
  const [selectedMember, setSelectedMember] = useState<BackofficeClientTeamMember | null>(null)
  const [memberSheetOpen, setMemberSheetOpen] = useState(false)
  const [memberEditOpen, setMemberEditOpen] = useState(false)
  const [memberDeleteOpen, setMemberDeleteOpen] = useState(false)
  const [removeFromTeamTarget, setRemoveFromTeamTarget] = useState<{
    member: BackofficeClientTeamMember
    teamId: string
  } | null>(null)
  const [isRemovingFromTeam, setIsRemovingFromTeam] = useState(false)
  const removeFromTeamInFlight = useRef(false)
  const [memberAccessActionId, setMemberAccessActionId] = useState<string | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addTeamOpen, setAddTeamOpen] = useState(false)
  const [selectedMemberTeamId, setSelectedMemberTeamId] = useState<string | null>(null)
  const [editingTeam, setEditingTeam] = useState<BackofficeClientTeam | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<BackofficeClientTeam | null>(null)
  const [addingMasterTeamId, setAddingMasterTeamId] = useState<string | null>(null)
  const [selectedEmailTeamId, setSelectedEmailTeamId] = useState<string | null>(null)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "invoices" || tab === "teams" || tab === "emails") {
      setActiveSection(tab)
    }
    const teamId = searchParams.get("teamId")
    if (teamId) setSelectedEmailTeamId(teamId)
  }, [searchParams, setActiveSection])

  useEffect(() => {
    if (!details?.fullName) return

    const currentName = searchParams.get("name")
    const currentTab = searchParams.get("tab")
    if (
      currentName === details.fullName &&
      (currentTab === "teams" || currentTab === "invoices" || currentTab === "emails")
    ) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set("name", details.fullName)

    if (currentTab !== "teams" && currentTab !== "invoices" && currentTab !== "emails") {
      params.set("tab", activeSection)
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [activeSection, details?.fullName, pathname, router, searchParams])

  function handleTabChange(nextSection: "teams" | "invoices" | "emails") {
    setActiveSection(nextSection)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextSection)

    if (details?.fullName) {
      params.set("name", details.fullName)
    }

    if (nextSection === "emails" && selectedEmailTeamId) {
      params.set("teamId", selectedEmailTeamId)
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleEmailTeamChange(teamId: string | null) {
    setSelectedEmailTeamId(teamId)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "emails")
    if (teamId) params.set("teamId", teamId)
    else params.delete("teamId")
    if (details?.fullName) params.set("name", details.fullName)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const isFiltered = useMemo(() => localFilters.query.trim().length > 0, [localFilters.query])

  useEffect(() => {
    const nextQuery = localFilters.query.trim()
    const currentQuery = filters.query.trim()
    if (nextQuery === currentQuery) return

    const debounceId = window.setTimeout(() => {
      void fetchDetails({ filters: localFilters, page: 1 })
    }, 300)

    return () => window.clearTimeout(debounceId)
  }, [fetchDetails, filters.query, localFilters])

  async function handleClearFilters() {
    setLocalFilters({ query: "" })
    await clearFilters()
  }

  async function handleToggleLifetime() {
    if (!details || lifetimeInFlight.current) return
    lifetimeInFlight.current = true
    setIsTogglingLifetime(true)
    const nextValue = details.plan.kind !== "lifetime"
    try {
      await service.updateClient(masterId, { hasPermanentSubscription: nextValue })
      toast.success(nextValue ? "Cliente tornado vitalício com sucesso" : "Plano vitalício removido com sucesso")
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar plano")
    } finally {
      setIsTogglingLifetime(false)
      lifetimeInFlight.current = false
    }
  }

  async function handleToggleMultiskill() {
    if (!details || multiskillInFlight.current) return
    multiskillInFlight.current = true
    setIsTogglingMultiskill(true)
    const nextValue = !details.multiskillEnabled
    try {
      await service.updateClient(masterId, { multiskillEnabled: nextValue })
      toast.success(
        nextValue
          ? "Conta habilitada para receber transferências MultiSkill"
          : "Transferências MultiSkill desabilitadas para esta conta"
      )
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar MultiSkill")
    } finally {
      setIsTogglingMultiskill(false)
      multiskillInFlight.current = false
    }
  }

  async function handleToggleUnlimitedUsers() {
    if (!details || unlimitedUsersInFlight.current) return
    unlimitedUsersInFlight.current = true
    setIsTogglingUnlimitedUsers(true)
    const nextValue = !details.hasUnlimitedUsers
    try {
      await service.updateClient(masterId, { hasUnlimitedUsers: nextValue })
      toast.success(
        nextValue
          ? "Usuários ilimitados habilitados. Cobrança de usuários será removida na próxima fatura."
          : "Usuários ilimitados desabilitados. Cobrança de usuários volta na próxima fatura."
      )
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar usuários ilimitados")
    } finally {
      setIsTogglingUnlimitedUsers(false)
      unlimitedUsersInFlight.current = false
    }
  }

  async function handleEnableMemberPro() {
    if (!details || memberProInFlight.current) return
    memberProInFlight.current = true
    setIsTogglingMemberPro(true)
    try {
      const accessExpiresAt = memberProExpiresAtFromDays(MEMBER_PRO_MAX_DAYS)
      await service.updateUserType(masterId, {
        userType: "member_pro",
        accessExpiresAt,
      })
      toast.success(
        `Member PRO habilitado por ${MEMBER_PRO_MAX_DAYS} dias. Usuários ilimitados também foram ativados.`
      )
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao habilitar Member PRO")
    } finally {
      setIsTogglingMemberPro(false)
      memberProInFlight.current = false
    }
  }

  async function handleDisableMemberPro() {
    if (!details || memberProInFlight.current) return
    memberProInFlight.current = true
    setIsTogglingMemberPro(true)
    try {
      await service.updateUserType(masterId, { userType: "common" })
      toast.success("Member PRO desabilitado. Cliente voltou ao tipo Comum.")
      setMemberProDisableOpen(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desabilitar Member PRO")
    } finally {
      setIsTogglingMemberPro(false)
      memberProInFlight.current = false
    }
  }

  async function handleSendMemberAccessEmail(
    member: BackofficeClientTeamMember,
    mode: "invite" | "reset_password"
  ) {
    if (memberAccessActionId) return

    setMemberAccessActionId(`${member.id}:${mode}`)
    const toastId = toast.loading(
      mode === "invite" ? "Reenviando convite..." : "Enviando reset de senha..."
    )

    try {
      const result = await service.sendAccessEmail(member.id, mode)
      toast.success(
        mode === "invite"
          ? `Convite reenviado para ${result.email}.`
          : `Reset de senha enviado para ${result.email}.`,
        { id: toastId }
      )
    } catch (error) {
      console.error("[BackofficeClientDetailsContainer][handleSendMemberAccessEmail]", error)
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar e-mail de acesso.",
        { id: toastId }
      )
    } finally {
      setMemberAccessActionId(null)
    }
  }

  async function handleAddMasterToTeam(team: BackofficeClientTeam) {
    if (addingMasterTeamId) return

    setAddingMasterTeamId(team.id)
    const toastId = toast.loading("Adicionando master ao time...")

    try {
      await service.addMasterToTeam(masterId, team.id)
      toast.success("Master adicionado ao time com sucesso.", { id: toastId })
      await reload()
    } catch (error) {
      console.error("[BackofficeClientDetailsContainer][handleAddMasterToTeam]", error)
      toast.error(
        error instanceof Error ? error.message : "Erro ao adicionar master ao time.",
        { id: toastId }
      )
    } finally {
      setAddingMasterTeamId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : error || !details ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between">
            <span>{error || "Não foi possível carregar os dados."}</span>
            <Button variant="outline" size="sm" onClick={reload}>
              Recarregar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 py-1 mb-2">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-16 w-16 rounded-full">
                <AvatarImage
                  src={details.profileIconUrl || undefined}
                  alt={details.fullName || details.email}
                />
                <AvatarFallback>{getInitials(details.fullName, details.email)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{details.fullName || "Sem nome"}</h1>
                  {details.plan.kind === "lifetime" && <Badge>Vitalício</Badge>}
                  {details.userType.slug === "member_pro" && !details.userType.isExpired ? (
                    <Badge variant="secondary">Member PRO</Badge>
                  ) : null}
                  {details.userType.slug === "member_pro" && details.userType.isExpired ? (
                    <Badge variant="outline">Member PRO expirado</Badge>
                  ) : null}
                  {details.multiskillEnabled ? (
                    <Badge variant="secondary">MultiSkill</Badge>
                  ) : null}
                  {details.hasUnlimitedUsers ? (
                    <Badge variant="secondary">Usuários ilimitados</Badge>
                  ) : null}
                  {details.subscription.hasAccess ? (
                    <Badge
                      variant="outline"
                      className="border-semantic-success-border bg-semantic-success-surface text-semantic-success gap-1"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Acesso ativo
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger gap-1"
                    >
                      <ShieldX className="h-3 w-3" />
                      Sem acesso
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">E-mail: {details.email}</p>
                <p className="text-sm text-muted-foreground">
                  Telefone: {details.phone || "Não informado"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Entrou na plataforma em {formatDate(details.createdAt, tz)}
                </p>
              </div>
            </div>
            {canManage && (
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <div className="text-right">
                    <p className="text-sm font-medium">MultiSkill</p>
                    <p className="text-xs text-muted-foreground">Receber transferências</p>
                  </div>
                  <Switch
                    checked={details.multiskillEnabled}
                    disabled={isTogglingMultiskill}
                    onCheckedChange={() => void handleToggleMultiskill()}
                  />
                </div>
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <div className="text-right">
                    <p className="text-sm font-medium">Usuários ilimitados</p>
                    <p className="text-xs text-muted-foreground">Sem checkout de usuários</p>
                  </div>
                  <Switch
                    checked={details.hasUnlimitedUsers}
                    disabled={isTogglingUnlimitedUsers}
                    onCheckedChange={() => void handleToggleUnlimitedUsers()}
                  />
                </div>
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <div className="text-right">
                    <p className="text-sm font-medium">Member PRO</p>
                    <p className="text-xs text-muted-foreground">
                      {details.userType.slug === "member_pro" &&
                      !details.userType.isExpired &&
                      details.userType.accessExpiresAt
                        ? `Expira em ${formatDate(details.userType.accessExpiresAt, tz)}`
                        : details.userType.slug === "member_pro" && details.userType.isExpired
                          ? "Acesso expirado"
                          : "Acesso Member PRO"}
                    </p>
                  </div>
                  <Switch
                    checked={
                      details.userType.slug === "member_pro" && !details.userType.isExpired
                    }
                    disabled={isTogglingMemberPro}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        void handleEnableMemberPro()
                        return
                      }
                      setMemberProDisableOpen(true)
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  className="shrink-0"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            )}
          </div>

          <LeadsFiltersLayout>
            <Input
              placeholder="Buscar por time, nome ou e-mail de membro"
              value={localFilters.query}
              onChange={(e) => setLocalFilters({ query: e.target.value })}
              className="h-8 w-62.5 lg:w-105"
            />
            {isFiltered ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 lg:px-3"
                onClick={() => void handleClearFilters()}
                disabled={isTeamsLoading}
              >
                Limpar
                <X data-icon="inline-end" />
              </Button>
            ) : null}
          </LeadsFiltersLayout>

          <Tabs
            value={activeSection}
            onValueChange={(value) => handleTabChange(value as "teams" | "invoices" | "emails")}
          >
            <TabsList>
              <TabsTrigger value="teams">Times</TabsTrigger>
              <TabsTrigger value="invoices">Faturas</TabsTrigger>
              <TabsTrigger value="emails">E-mails</TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-4">
              {canManage && (
                <div className="mb-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAddTeamOpen(true)}>
                    Adicionar time
                  </Button>
                  <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                    Adicionar usuário
                  </Button>
                </div>
              )}

              <div className="rounded-md border overflow-hidden">
                <div
                  className={cn(
                    "grid gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    TEAMS_TABLE_GRID
                  )}
                >
                  <span aria-hidden className="size-4" />
                  <span className="text-center">Time</span>
                  <span className="text-center">Membros</span>
                  <span className="text-center">Criado em</span>
                  <span className="text-center">{canManage ? "Ações" : ""}</span>
                </div>

                {teamsError ? (
                  <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {teamsError}
                  </div>
                ) : null}

                {isTeamsLoading ? (
                  <div className="space-y-1 p-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : teams.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">
                    Nenhum time encontrado com os filtros aplicados.
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {teams.map((team) => {
                      const masterMissing = !team.members.some((member) => member.isMaster)

                      return (
                      <AccordionItem key={team.id} value={team.id} className="border-b last:border-b-0">
                        <div
                          className={cn(
                            "grid items-center gap-3 px-4",
                            TEAMS_TABLE_GRID
                          )}
                        >
                          <AccordionPrimitive.Header className="col-span-4 grid grid-cols-subgrid [grid-column:span_4]">
                            <AccordionPrimitive.Trigger
                              className={cn(
                                "col-span-4 grid grid-cols-subgrid items-center py-3 text-sm font-medium text-left transition-all",
                                "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "[&[data-state=open]>svg]:rotate-180"
                              )}
                            >
                              <ChevronDown className="mx-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                              <span className="truncate text-center font-medium">
                                {team.name}
                              </span>
                              <span className="text-center tabular-nums">
                                {team.membersCount}
                              </span>
                              <span className="text-center tabular-nums">
                                {formatDate(team.createdAt, tz)}
                              </span>
                            </AccordionPrimitive.Trigger>
                          </AccordionPrimitive.Header>

                          <div className="flex justify-center">
                            {canManage ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-8"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <MoreHorizontal />
                                    <span className="sr-only">Ações do time</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {masterMissing ? (
                                    <DropdownMenuItem
                                      disabled={addingMasterTeamId !== null}
                                      onClick={() => void handleAddMasterToTeam(team)}
                                    >
                                      <Crown />
                                      {addingMasterTeamId === team.id
                                        ? "Adicionando master..."
                                        : "Adicionar master ao time"}
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem onClick={() => setEditingTeam(team)}>
                                    <Pencil />
                                    Editar time
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => setDeletingTeam(team)}
                                  >
                                    <Trash2 />
                                    Excluir time
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </div>
                        </div>
                        <AccordionContent className="px-4 pb-4">
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-center">Nome</TableHead>
                                  <TableHead className="text-center">E-mail</TableHead>
                                  <TableHead className="text-center">Telefone</TableHead>
                                  <TableHead className="text-center">Papel</TableHead>
                                  <TableHead className="text-center">Funções</TableHead>
                                  <TableHead className="text-center">Conta Google Conectada</TableHead>
                                  <TableHead className="text-center">Data de inclusão</TableHead>
                                  <TableHead className="text-center">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {team.members.map((member) => (
                                  <TableRow key={`${member.id}-${member.addedAt}`} className="text-center">
                                    <TableCell className="font-medium">
                                      {member.fullName || "Sem nome"}
                                    </TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>{maskPhone(member.phone ?? "") || "—"}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{member.role}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {member.functions.length > 0
                                        ? member.functions.join(", ")
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="flex justify-center">
                                      {member.googleCalendarConnected ? <CircleCheckBig className="text-green-500" /> : <CircleX className="text-red-500" />}
                                    </TableCell>
                                    <TableCell>{formatDate(member.addedAt, tz)}</TableCell>
                                    <TableCell className="text-center">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={memberAccessActionId !== null}
                                          >
                                            <MoreHorizontal />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedMember(member)
                                              setMemberSheetOpen(true)
                                            }}
                                          >
                                            <Eye />
                                            Visualizar
                                          </DropdownMenuItem>
                                          {canManage && (
                                            <DropdownMenuItem
                                              onClick={() => {
                                                setSelectedMember(member)
                                                setSelectedMemberTeamId(team.id)
                                                setMemberEditOpen(true)
                                              }}
                                            >
                                              <Pencil />
                                              Editar
                                            </DropdownMenuItem>
                                          )}
                                          {canManage && member.accessStatus === "pending_first_access" ? (
                                            <DropdownMenuItem
                                              onClick={() => void handleSendMemberAccessEmail(member, "invite")}
                                            >
                                              <Mail />
                                              Reenviar convite
                                            </DropdownMenuItem>
                                          ) : null}
                                          {canManage && member.accessStatus === "active" ? (
                                            <DropdownMenuItem
                                              onClick={() => void handleSendMemberAccessEmail(member, "reset_password")}
                                            >
                                              <KeyRound />
                                              Enviar reset de senha
                                            </DropdownMenuItem>
                                          ) : null}
                                          {canManage && !member.isMaster ? (
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                              onClick={() => {
                                                setRemoveFromTeamTarget({ member, teamId: team.id })
                                              }}
                                            >
                                              <Trash2 />
                                              Remover do time
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
                        </AccordionContent>
                      </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}

                <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Resultados por página</span>
                    <Select
                      value={String(teamsPagination.pageSize)}
                      onValueChange={(value) => {
                        const nextPageSize = Number.parseInt(value, 10)
                        if (Number.isFinite(nextPageSize)) {
                          void setTeamsPageSize(nextPageSize)
                        }
                      }}
                      disabled={isTeamsLoading}
                    >
                      <SelectTrigger className="w-23">
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTeamsPage(teamsPagination.page - 1)}
                      disabled={!teamsPagination.hasPreviousPage || isTeamsLoading}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Página {teamsPagination.page} de {teamsPagination.totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTeamsPage(teamsPagination.page + 1)}
                      disabled={!teamsPagination.hasNextPage || isTeamsLoading}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <Card>
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">Plano do cliente</span>
                    <Button
                      variant={details.plan.kind === "lifetime" ? "outline" : "default"}
                      size="sm"
                      onClick={() => void handleToggleLifetime()}
                      disabled={isTogglingLifetime}
                      className={
                        details.plan.kind === "lifetime"
                          ? "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          : ""
                      }
                    >
                      {details.plan.kind === "lifetime" ? (
                        <>
                          <X className="mr-2 h-4 w-4" />
                          {isTogglingLifetime ? "Removendo..." : "Remover plano vitalício"}
                        </>
                      ) : (
                        <>
                          <Crown className="mr-2 h-4 w-4" />
                          {isTogglingLifetime ? "Aplicando..." : "Tornar cliente vitalício"}
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={invoiceFilters.status}
                      onValueChange={(value) => {
                        void setInvoicesFilters({
                          status: value as "all" | "paid" | "overdue" | "upcoming",
                        })
                      }}
                      disabled={isInvoicesLoading}
                    >
                      <SelectTrigger className="w-52.5">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVOICE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={invoiceFilters.period}
                      onValueChange={(value) => {
                        void setInvoicesFilters({
                          period: value as "all" | "7d" | "30d" | "90d" | "this_month",
                        })
                      }}
                      disabled={isInvoicesLoading}
                    >
                      <SelectTrigger className="w-52.5">
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVOICE_PERIOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={isInvoicesLoading}
                      onClick={() => {
                        void setInvoicesFilters({ status: "all", period: "all" })
                      }}
                    >
                      Limpar filtros
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    >
                      Cobradas: {invoicesSummary.charged}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-orange-500/40 bg-orange-500/20 text-orange-200"
                    >
                      A vencer: {invoicesSummary.upcoming}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-red-500/40 bg-red-500/15 text-red-300"
                    >
                      Vencidas: {invoicesSummary.overdue}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {invoicesError ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {invoicesError}
                    </div>
                  ) : isInvoicesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-md border overflow-hidden">
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[16%] px-4 text-left">
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5" />
                                  ID
                                </span>
                              </TableHead>
                              <TableHead className="w-[14%] px-4 text-left">
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5" />
                                  Nome
                                </span>
                              </TableHead>
                              <TableHead className="w-[12%] px-4 text-left">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Data
                                </span>
                              </TableHead>
                              <TableHead className="w-[12%] px-4 text-left">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Vencimento
                                </span>
                              </TableHead>
                              <TableHead className="w-[12%] px-4 text-right">
                                <span className="inline-flex items-center gap-1">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  Valor
                                </span>
                              </TableHead>
                              <TableHead className="w-[12%] px-4 text-center">
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5" />
                                  Status
                                </span>
                              </TableHead>
                              <TableHead className="w-[22%] px-4 text-center">
                                <span className="inline-flex items-center gap-1">
                                  <Eye className="h-3.5 w-3.5" />
                                  Ações
                                </span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoices.map((invoice) => {
                              const statusInfo = INVOICE_STATUS_BADGES[invoice.statusGroup]
                              const statusLabel =
                                invoice.status === "WAIVED"
                                  ? "Dispensada"
                                  : invoice.status === "PENDING" && invoice.source === "pending_action"
                                    ? "Aguardando checkout"
                                    : statusInfo.label

                              return (
                                <TableRow key={invoice.id} className="h-12">
                                  <TableCell
                                    className="px-4 align-middle font-mono text-xs truncate"
                                    title={invoice.invoiceIdDisplay}
                                  >
                                    {invoice.invoiceIdDisplay}
                                  </TableCell>
                                  <TableCell className="px-4 align-middle">
                                    {invoice.invoiceName}
                                  </TableCell>
                                  <TableCell className="px-4 align-middle">
                                    {formatNullableDate(invoice.dateCreated, tz)}
                                  </TableCell>
                                  <TableCell className="px-4 align-middle">
                                    {formatNullableDate(invoice.dueDate, tz)}
                                  </TableCell>
                                  <TableCell className="px-4 text-right align-middle font-medium tabular-nums">
                                    {formatCurrency(invoice.value)}
                                  </TableCell>
                                  <TableCell className="px-4 text-center align-middle">
                                    <Badge
                                      variant={statusInfo.variant}
                                      className={statusInfo.className}
                                    >
                                      {statusLabel}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="px-4 text-center align-middle">
                                    <div className="inline-flex items-center gap-2">
                                      <Button asChild variant="outline" size="sm">
                                        <Link
                                          href={`/backoffice/clients/${details.id}/invoices/${invoice.id}`}
                                          className="inline-flex items-center gap-1"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          Visualizar
                                        </Link>
                                      </Button>
                                      {invoice.checkoutUrl ? (
                                        <Button asChild variant="default" size="sm">
                                          <a
                                            href={invoice.checkoutUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            Checkout
                                          </a>
                                        </Button>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {invoicesPagination.totalPages > 1 ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setInvoicesPage(invoicesPagination.page - 1)}
                            disabled={!invoicesPagination.hasPreviousPage || isInvoicesLoading}
                          >
                            Anterior
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Página {invoicesPagination.page} de {invoicesPagination.totalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setInvoicesPage(invoicesPagination.page + 1)}
                            disabled={!invoicesPagination.hasNextPage || isInvoicesLoading}
                          >
                            Próxima
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <BackofficeClientStudioEmailsPanel
                masterId={masterId}
                teams={details?.allTeams ?? []}
                selectedTeamId={selectedEmailTeamId}
                onSelectedTeamIdChange={handleEmailTeamChange}
                canManage={canManage}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {details && (
        <>
          <BackofficeClientEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            masterId={masterId}
            details={details}
            service={service}
            canManage={canManage}
            onSuccess={reload}
            onDeleteRequest={() => {
              setEditOpen(false)
              setDeleteOpen(true)
            }}
          />
          <BackofficeClientDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            masterId={masterId}
            details={details}
            teams={teams}
            service={service}
          />
          <AlertDialog
            open={memberProDisableOpen}
            onOpenChange={
              isTogglingMemberPro ? undefined : (open) => !open && setMemberProDisableOpen(false)
            }
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desabilitar Member PRO?</AlertDialogTitle>
                <AlertDialogDescription>
                  O cliente voltará ao tipo Comum. Usuários ilimitados podem ser removidos se não
                  houver outra concessão (vitalício ou adesão anual).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isTogglingMemberPro}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    void handleDisableMemberPro()
                  }}
                  disabled={isTogglingMemberPro}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isTogglingMemberPro ? "Desabilitando..." : "Desabilitar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <BackofficeMemberProfileSheet
        open={memberSheetOpen}
        onOpenChange={setMemberSheetOpen}
        member={selectedMember}
        service={service}
      />

      <BackofficeMemberEditDialog
        open={memberEditOpen}
        onOpenChange={setMemberEditOpen}
        member={selectedMember}
        teamId={selectedMemberTeamId}
        details={details}
        service={service}
        canManage={canManage}
        onSuccess={reload}
      />

      <AlertDialog
        open={removeFromTeamTarget != null}
        onOpenChange={(open) => {
          if (!open && !isRemovingFromTeam) setRemoveFromTeamTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do time?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove apenas a associação do membro ao time. A conta e os leads
              permanecem intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingFromTeam}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemovingFromTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void (async () => {
                  if (!removeFromTeamTarget || removeFromTeamInFlight.current) return
                  removeFromTeamInFlight.current = true
                  setIsRemovingFromTeam(true)
                  try {
                    await service.removeMemberFromTeam(
                      removeFromTeamTarget.member.id,
                      removeFromTeamTarget.teamId
                    )
                    toast.success("Membro removido do time")
                    setRemoveFromTeamTarget(null)
                    reload()
                  } catch (err) {
                    console.error("[BackofficeClientDetailsContainer][removeFromTeam]", err)
                    toast.error(err instanceof Error ? err.message : "Erro ao remover do time")
                  } finally {
                    removeFromTeamInFlight.current = false
                    setIsRemovingFromTeam(false)
                  }
                })()
              }}
            >
              {isRemovingFromTeam ? "Removendo..." : "Remover do time"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BackofficeMemberDeleteDialog
        open={memberDeleteOpen}
        onOpenChange={setMemberDeleteOpen}
        member={selectedMember}
        service={service}
        onSuccess={reload}
      />

      <BackofficeAddMemberDialog
        open={addMemberOpen}
        masterId={masterId}
        teams={details?.allTeams ?? []}
        masterUserType={details?.userType}
        service={service}
        onOpenChange={setAddMemberOpen}
        onSaved={reload}
      />

      <BackofficeAddTeamDialog
        open={addTeamOpen}
        masterId={masterId}
        masterUserType={details?.userType}
        service={service}
        onOpenChange={setAddTeamOpen}
        onSaved={reload}
      />

      <BackofficeTeamEditDialog
        open={editingTeam !== null}
        onOpenChange={(open) => { if (!open) setEditingTeam(null) }}
        team={editingTeam}
        allTeams={details?.allTeams ?? []}
        masterId={masterId}
        service={service}
        onSuccess={() => { setEditingTeam(null); void reload() }}
      />

      <BackofficeTeamDeleteDialog
        open={deletingTeam !== null}
        onOpenChange={(open) => { if (!open) setDeletingTeam(null) }}
        team={deletingTeam}
        masterId={masterId}
        service={service}
        onSuccess={() => { setDeletingTeam(null); void reload() }}
      />
    </div>
  )
}
