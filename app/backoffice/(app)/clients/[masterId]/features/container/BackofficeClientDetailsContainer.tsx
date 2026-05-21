"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CalendarDays, Crown, DollarSign, Eye, MoreHorizontal, Pencil, Search, Tag, Trash2, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CircleX, CircleCheckBig } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import type { BackofficeClientTeamMember } from "../context/BackofficeClientDetailsTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, parseDateKeyToUtc } from "@/lib/dates"
import { maskPhone } from "@/lib/masks"

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
    setFilters,
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
  const lifetimeInFlight = useRef(false)
  const [selectedMember, setSelectedMember] = useState<BackofficeClientTeamMember | null>(null)
  const [memberSheetOpen, setMemberSheetOpen] = useState(false)
  const [memberEditOpen, setMemberEditOpen] = useState(false)
  const [memberDeleteOpen, setMemberDeleteOpen] = useState(false)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "invoices" || tab === "teams") {
      setActiveSection(tab)
    }
  }, [searchParams, setActiveSection])

  useEffect(() => {
    if (!details?.fullName) return

    const currentName = searchParams.get("name")
    const currentTab = searchParams.get("tab")
    if (currentName === details.fullName && (currentTab === "teams" || currentTab === "invoices")) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set("name", details.fullName)

    if (currentTab !== "teams" && currentTab !== "invoices") {
      params.set("tab", activeSection)
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [activeSection, details?.fullName, pathname, router, searchParams])

  function handleTabChange(nextSection: "teams" | "invoices") {
    setActiveSection(nextSection)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextSection)

    if (details?.fullName) {
      params.set("name", details.fullName)
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function updateFilter(value: string) {
    const next = { query: value }
    setLocalFilters(next)
    setFilters(next)
  }

  async function handleSearch() {
    await fetchDetails({
      filters: localFilters,
      page: 1,
    })
  }

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

          <LeadsFiltersLayout>
            <Input
              placeholder="Buscar por time, nome ou e-mail de membro"
              value={localFilters.query}
              onChange={(e) => updateFilter(e.target.value)}
              className="h-8 w-[250px] lg:w-[420px]"
            />
            <Button size="sm" onClick={handleSearch} disabled={isTeamsLoading}>
              <Search className="mr-1 h-4 w-4" />
              Buscar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearFilters}
              disabled={isTeamsLoading}
            >
              Limpar
            </Button>
          </LeadsFiltersLayout>

          <Tabs
            value={activeSection}
            onValueChange={(value) => handleTabChange(value as "teams" | "invoices")}
          >
            <TabsList>
              <TabsTrigger value="teams">Times</TabsTrigger>
              <TabsTrigger value="invoices">Faturas</TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-4">
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="text-center">Time</span>
                  <span className="text-center">Membros</span>
                  <span className="text-center">Criado em</span>
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
                    {teams.map((team) => (
                      <AccordionItem key={team.id} value={team.id}>
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="grid w-full grid-cols-[2fr_1fr_1fr] gap-3 text-sm pr-4 items-center">
                            <span className="font-medium text-center">{team.name}</span>
                            <span className="text-center">{team.membersCount}</span>
                            <span className="text-center">{formatDate(team.createdAt, tz)}</span>
                          </div>
                        </AccordionTrigger>
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
                                          <Button variant="ghost" size="sm">
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
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedMember(member)
                                              setMemberEditOpen(true)
                                            }}
                                          >
                                            <Pencil />
                                            Editar
                                          </DropdownMenuItem>
                                          {!member.isMaster ? (
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                              onClick={() => {
                                                setSelectedMember(member)
                                                setMemberDeleteOpen(true)
                                              }}
                                            >
                                              <Trash2 />
                                              Deletar conta
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
                    ))}
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
                      <SelectTrigger className="h-8 w-[92px]">
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
                      <SelectTrigger className="h-9 w-[210px]">
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
                      <SelectTrigger className="h-9 w-[210px]">
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
                              <TableHead className="w-[20%] px-4 text-left">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Data da fatura
                                </span>
                              </TableHead>
                              <TableHead className="w-[20%] px-4 text-left">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Vencimento
                                </span>
                              </TableHead>
                              <TableHead className="w-[18%] px-4 text-right">
                                <span className="inline-flex items-center gap-1">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  Valor
                                </span>
                              </TableHead>
                              <TableHead className="w-[18%] px-4 text-center">
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5" />
                                  Status
                                </span>
                              </TableHead>
                              <TableHead className="w-[24%] px-4 text-center">
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

                              return (
                                <TableRow key={invoice.id} className="h-12">
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
                                      {statusInfo.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="px-4 text-center align-middle">
                                    <Button asChild variant="outline" size="sm">
                                      <Link
                                        href={`/backoffice/clients/${details.id}/invoices/${invoice.id}`}
                                        className="inline-flex items-center gap-1"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Visualizar
                                      </Link>
                                    </Button>
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
        details={details}
        service={service}
        onSuccess={reload}
        onDeleteRequest={() => {
          setMemberEditOpen(false)
          setMemberDeleteOpen(true)
        }}
      />

      <BackofficeMemberDeleteDialog
        open={memberDeleteOpen}
        onOpenChange={setMemberDeleteOpen}
        member={selectedMember}
        service={service}
        onSuccess={reload}
      />
    </div>
  )
}
