"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useBackofficeClientDetails } from "../context/BackofficeClientDetailsContext"

const INVOICE_STATUS_BADGES: Record<
  "paid" | "overdue" | "upcoming" | "other",
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  paid: { label: "Paga", variant: "default" },
  overdue: { label: "Vencida", variant: "destructive" },
  upcoming: { label: "A vencer", variant: "outline" },
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR")
}

function formatNullableDate(value: string | null) {
  if (!value) return "—"
  return formatDate(value)
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
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
          <div className="flex flex-wrap items-center justify-start gap-4 py-1 mb-2
          ">
            <Avatar className="h-16 w-16 rounded-full">
              <AvatarImage src={details.profileIconUrl || undefined} alt={details.fullName || details.email} />
              <AvatarFallback>{getInitials(details.fullName, details.email)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{details.fullName || "Sem nome"}</h1>
                {details.plan.kind === "lifetime" && <Badge>Vitalício</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                E-mail: {details.email}
              </p>
              <p className="text-sm text-muted-foreground">
                Telefone: {details.phone || "Não informado"}
              </p>
              <p className="text-sm text-muted-foreground">
                Entrou na plataforma em {formatDate(details.createdAt)}
              </p>
            </div>
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
            <Button size="sm" variant="outline" onClick={handleClearFilters} disabled={isTeamsLoading}>
              Limpar
            </Button>
          </LeadsFiltersLayout>

          <Tabs value={activeSection} onValueChange={(value) => handleTabChange(value as "teams" | "invoices")}>
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
                            <span className="text-center">{formatDate(team.createdAt)}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>E-mail</TableHead>
                                  <TableHead>Telefone</TableHead>
                                  <TableHead>Papel</TableHead>
                                  <TableHead>Funções</TableHead>
                                  <TableHead>Data de inclusão</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {team.members.map((member) => (
                                  <TableRow key={`${member.id}-${member.addedAt}`}>
                                    <TableCell className="font-medium">{member.fullName || "Sem nome"}</TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>{member.phone || "—"}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{member.role}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {member.functions.length > 0 ? member.functions.join(", ") : "—"}
                                    </TableCell>
                                    <TableCell>{formatDate(member.addedAt)}</TableCell>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Faturas</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isInvoicesLoading}
                      onClick={() => {
                        void setInvoicesFilters({ status: "all", period: "all" })
                      }}
                    >
                      Limpar filtros
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
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">Cobradas: {invoicesSummary.charged}</Badge>
                    <Badge variant="outline">A vencer: {invoicesSummary.upcoming}</Badge>
                    <Badge variant="destructive">Vencidas: {invoicesSummary.overdue}</Badge>
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
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data da fatura</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoices.map((invoice) => {
                              const statusInfo = INVOICE_STATUS_BADGES[invoice.statusGroup]

                              return (
                                <TableRow key={invoice.id}>
                                  <TableCell>{formatNullableDate(invoice.dateCreated)}</TableCell>
                                  <TableCell>{formatNullableDate(invoice.dueDate)}</TableCell>
                                  <TableCell className="font-medium">{formatCurrency(invoice.value)}</TableCell>
                                  <TableCell>
                                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/backoffice/clients/${details.id}/invoices/${invoice.id}`}>
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
    </div>
  )
}
