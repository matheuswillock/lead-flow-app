"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertCircle, ChevronDown, Plus, Search, Users } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeClients } from "../context/BackofficeClientsContext"
import type { BackofficeClientsFilters } from "../context/BackofficeClientsTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatInTz } from "@/lib/dates"
import { BackofficeAdhesionDialog } from "../../adhesions/features/components/BackofficeAdhesionDialog"
import { BackofficeAdhesionsService } from "../../adhesions/features/services/BackofficeAdhesionsService"

const CLIENTS_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 30, 40, 50]
const adhesionsService = new BackofficeAdhesionsService()

function formatDate(value: string, tz: string) {
  return formatInTz(new Date(value), "dd/MM/yyyy", tz)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function renderPlanLabel(plan: { label: string; amount: number | null }) {
  if (plan.amount === null) return plan.label
  return `${plan.label} (${formatCurrency(plan.amount)})`
}

export function BackofficeClientsContainer() {
  const { tz } = useTimezone()
  const {
    clients,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    fetchClients,
    setClientsPage,
    setClientsPageSize,
    clearFilters,
  } = useBackofficeClients()

  const [localFilters, setLocalFilters] = useState<BackofficeClientsFilters>(filters)
  const [openClientId, setOpenClientId] = useState<string>("")
  const [newAdhesionDialogOpen, setNewAdhesionDialogOpen] = useState(false)

  const totalTeams = useMemo(
    () => clients.reduce((acc, client) => acc + client.teamsCount, 0),
    [clients]
  )

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  function handleFilterChange(field: keyof BackofficeClientsFilters, value: string) {
    const next = {
      ...localFilters,
      [field]: value,
    }
    setLocalFilters(next)
    setFilters(next)
  }

  async function handleSearch() {
    await fetchClients({ filters: localFilters, page: 1 })
  }

  async function handleClear() {
    const cleared: BackofficeClientsFilters = {
      query: "",
    }
    setLocalFilters(cleared)
    setFilters(cleared)
    await clearFilters()
  }

  function toggleClientAccordion(clientId: string) {
    setOpenClientId((previous) => (previous === clientId ? "" : clientId))
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setNewAdhesionDialogOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nova adesão
          </Button>
          <Badge variant="outline" className="font-normal">
            {pagination.totalItems} usuários master
          </Badge>
          <Badge variant="outline" className="font-normal">
            {totalTeams} times na página
          </Badge>
        </div>
      </div>

      <LeadsFiltersLayout>
        <Input
          placeholder="Buscar por nome/e-mail de usuário ou nome do time"
          value={localFilters.query}
          onChange={(e) => handleFilterChange("query", e.target.value)}
          className="h-8 w-[260px] lg:w-[420px]"
        />
        <Button size="sm" onClick={handleSearch} disabled={isLoading}>
          <Search className="mr-1 h-4 w-4" />
          Buscar
        </Button>
        <Button size="sm" variant="outline" onClick={handleClear} disabled={isLoading}>
          Limpar
        </Button>
      </LeadsFiltersLayout>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <Button size="sm" variant="outline" onClick={() => fetchClients({ page: pagination.page })}>
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <div className="grid grid-cols-[1.8fr_1fr_1.8fr_1.2fr_0.8fr_1.2fr_1fr_0.9fr] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground min-w-[1200px]">
          <span className="text-center">Usuário master</span>
          <span className="text-center">Criado em</span>
          <span className="text-center">E-mail</span>
          <span className="text-center">Telefone</span>
          <span className="text-center">Times</span>
          <span className="text-center">Plano</span>
          <span className="text-center">Usuários</span>
          <span className="text-center">Ação</span>
        </div>

        {isLoading ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum usuário master encontrado
          </div>
        ) : (
          <div className="overflow-auto">
            <Accordion
              type="single"
              collapsible
              value={openClientId}
              onValueChange={setOpenClientId}
              className="w-full min-w-[1200px]"
            >
              {clients.map((client) => (
                <AccordionItem key={client.id} value={client.id} className="border-b last:border-b-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleClientAccordion(client.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        toggleClientAccordion(client.id)
                      }
                    }}
                    className="grid w-full cursor-pointer grid-cols-[1.8fr_1fr_1.8fr_1.2fr_0.8fr_1.2fr_1fr_0.9fr] gap-3 px-4 py-3 text-sm pr-8 items-center hover:bg-muted/10"
                  >
                    <span className="font-medium truncate text-center">{client.fullName || "Sem nome"}</span>
                    <span className="text-center">{formatDate(client.createdAt, tz)}</span>
                    <span className="truncate text-center">{client.email}</span>
                    <span className="truncate text-center">{client.phone || "—"}</span>
                    <span className="inline-flex items-center justify-center gap-1">
                      {client.teamsCount}
                    </span>
                    <span className="text-center">{renderPlanLabel(client.plan)}</span>
                    <span className="inline-flex items-center justify-center gap-1">
                      <Users className="h-4 w-4" />
                      {client.linkedUsersCount}
                    </span>
                    <span className="flex items-center justify-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Link href={`/backoffice/clients/${client.id}?name=${encodeURIComponent(client.fullName || "Usuário")}&tab=teams`}>
                          Visualizar
                        </Link>
                      </Button>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                          openClientId === client.id ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </span>
                  </div>

                  <AccordionContent className="px-4 pb-4 pt-1">
                    {client.teams.length === 0 ? (
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        Este usuário master não possui times.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Time</TableHead>
                              <TableHead>Criado em</TableHead>
                              <TableHead>Membros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {client.teams.map((team) => (
                              <TableRow key={team.id}>
                                <TableCell className="font-medium">{team.name}</TableCell>
                                <TableCell>{formatDate(team.createdAt, tz)}</TableCell>
                                <TableCell>{team.membersCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Resultados por página</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) => {
                    const nextPageSize = Number.parseInt(value, 10)
                    if (Number.isFinite(nextPageSize)) {
                      void setClientsPageSize(nextPageSize)
                    }
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-8 w-[92px]">
                    <SelectValue placeholder="10" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENTS_PAGE_SIZE_OPTIONS.map((option) => (
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
                  onClick={() => setClientsPage(pagination.page - 1)}
                  disabled={!pagination.hasPreviousPage || isLoading}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setClientsPage(pagination.page + 1)}
                  disabled={!pagination.hasNextPage || isLoading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BackofficeAdhesionDialog
        open={newAdhesionDialogOpen}
        mode="create"
        service={adhesionsService}
        onOpenChange={setNewAdhesionDialogOpen}
      />
    </div>
  )
}
