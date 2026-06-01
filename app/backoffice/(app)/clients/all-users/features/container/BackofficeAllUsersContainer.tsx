"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Crown, Eye, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { toast } from "sonner"
import { BackofficeMemberDeleteDialog } from "@/app/backoffice/(app)/clients/[masterId]/features/components/BackofficeMemberDeleteDialog"
import { BackofficeMemberEditDialog } from "@/app/backoffice/(app)/clients/[masterId]/features/components/BackofficeMemberEditDialog"
import type {
  BackofficeClientDetails,
  BackofficeClientTeamMember,
} from "@/app/backoffice/(app)/clients/[masterId]/features/context/BackofficeClientDetailsTypes"
import { BackofficeClientDetailsService } from "@/app/backoffice/(app)/clients/[masterId]/features/services/BackofficeClientDetailsService"
import { useBackofficeAllUsers } from "../context/BackofficeAllUsersContext"
import type {
  BackofficeAllUsersItem,
  BackofficeAllUsersFilters,
  BackofficeAllUsersPlanFilter,
  BackofficeAllUsersRoleFilter,
} from "../context/BackofficeAllUsersTypes"
import { BackofficeAllUsersDetailSheet } from "../components/BackofficeAllUsersDetailSheet"

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 30, 40, 50]

const ROLE_OPTIONS: { value: BackofficeAllUsersRoleFilter | "all"; label: string }[] = [
  { value: "all", label: "Todos os papéis" },
  { value: "master", label: "Master" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operador" },
]

const PLAN_OPTIONS: { value: BackofficeAllUsersPlanFilter | "all"; label: string }[] = [
  { value: "all", label: "Todos os planos" },
  { value: "lifetime", label: "Vitalício" },
  { value: "monthly", label: "Mensal" },
  { value: "trial", label: "Trial" },
  { value: "none", label: "Sem plano ativo" },
]

function formatDate(value: string, tz: string) {
  return formatIntimezone(new Date(value), "dd/MM/yyyy", tz)
}

function getRoleBadge(role: string, isMaster: boolean) {
  if (isMaster) {
    return (
      <Badge
        variant="outline"
        className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"
      >
        <Crown className="size-3" />
        Master
      </Badge>
    )
  }
  if (role === "manager") {
    return (
      <Badge
        variant="outline"
        className="border-semantic-info-border bg-semantic-info-surface text-semantic-info"
      >
        Manager
      </Badge>
    )
  }
  return <Badge variant="secondary">Operador</Badge>
}

export function BackofficeAllUsersContainer() {
  const { tz } = useTimezone()
  const clientDetailsService = useMemo(() => new BackofficeClientDetailsService(), [])
  const {
    items,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    fetchUsers,
    setUsersPage,
    setUsersPageSize,
    clearFilters,
    openUserSheet,
  } = useBackofficeAllUsers()

  const [localFilters, setLocalFilters] = useState<BackofficeAllUsersFilters>(filters)
  const [selectedMember, setSelectedMember] = useState<BackofficeClientTeamMember | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<BackofficeClientDetails | null>(null)
  const [memberEditOpen, setMemberEditOpen] = useState(false)
  const [memberDeleteOpen, setMemberDeleteOpen] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    const nextQuery = localFilters.query.trim()
    const currentQuery = filters.query.trim()
    if (nextQuery === currentQuery) return

    const debounceId = window.setTimeout(() => {
      const updated = { ...localFilters, query: localFilters.query }
      void fetchUsers({ filters: updated, page: 1 })
    }, 300)

    return () => window.clearTimeout(debounceId)
  }, [fetchUsers, filters.query, localFilters])

  const roleCounts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.isMaster) acc.master += 1
        else if (item.role === "manager") acc.manager += 1
        else if (item.role === "operator") acc.operator += 1
        return acc
      },
      { master: 0, manager: 0, operator: 0 }
    )
  }, [items])

  const isFiltered = useMemo(() => {
    return (
      localFilters.query.trim().length > 0 ||
      localFilters.role !== "all" ||
      localFilters.plan !== "all"
    )
  }, [localFilters.plan, localFilters.query, localFilters.role])

  function handleQueryChange(value: string) {
    setLocalFilters((prev) => ({ ...prev, query: value }))
  }

  function handleRoleChange(values: string[]) {
    const selected = values[values.length - 1]
    const next = (selected ?? "all") as BackofficeAllUsersRoleFilter | "all"
    const updated = { ...localFilters, role: next }
    setLocalFilters(updated)
    setFilters(updated)
    void fetchUsers({ filters: updated, page: 1 })
  }

  function handlePlanChange(values: string[]) {
    const selected = values[values.length - 1]
    const next = (selected ?? "all") as BackofficeAllUsersPlanFilter | "all"
    const updated = { ...localFilters, plan: next }
    setLocalFilters(updated)
    setFilters(updated)
    void fetchUsers({ filters: updated, page: 1 })
  }

  async function handleClear() {
    const cleared: BackofficeAllUsersFilters = {
      query: "",
      role: "all",
      plan: "all",
    }
    setLocalFilters(cleared)
    await clearFilters()
  }

  function buildFallbackMember(item: BackofficeAllUsersItem): BackofficeClientTeamMember {
    return {
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      phone: item.phone,
      addedAt: item.createdAt,
      role: item.isMaster ? "master" : item.role,
      googleCalendarConnected: item.googleCalendarConnected,
      googleEmail: null,
      functions: [],
      isMaster: item.isMaster,
    }
  }

  function getMasterId(item: BackofficeAllUsersItem) {
    if (item.isMaster) return item.id
    return item.master?.id ?? null
  }

  async function resolveMemberContext(
    item: BackofficeAllUsersItem,
    options?: { loadDetails?: boolean }
  ) {
    if (actionLoadingId) return null

    setActionLoadingId(item.id)
    try {
      const fallbackMember = buildFallbackMember(item)
      let details: BackofficeClientDetails | null = null
      let member: BackofficeClientTeamMember = fallbackMember

      if (options?.loadDetails) {
        const masterId = getMasterId(item)
        if (!masterId) {
          toast.info("Usuário sem cliente vinculado no momento. Edição/deleção disponível com dados básicos.")
        } else {
          try {
            details = await clientDetailsService.getByMasterId(masterId, {
              page: 1,
              pageSize: 100,
            })
            const foundMember = details.teams
              .flatMap((team) => team.members)
              .find((teamMember) => teamMember.id === item.id)
            if (foundMember) {
              member = foundMember
            } else {
              toast.info("Usuário sem vínculo de time no cliente. Edição/deleção disponível com dados básicos.")
            }
          } catch (err) {
            console.error("[BackofficeAllUsersContainer][resolveMemberContext]", err)
            toast.error("Falha ao carregar contexto do cliente. Você ainda pode editar e deletar este usuário.")
          }
        }
      }

      setSelectedDetails(details)
      setSelectedMember(member)
      return { details, member }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados do usuário")
      return null
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleOpenEdit(item: BackofficeAllUsersItem) {
    const result = await resolveMemberContext(item, { loadDetails: true })
    if (!result) return
    setMemberEditOpen(true)
  }

  async function handleOpenDelete(item: BackofficeAllUsersItem) {
    const result = await resolveMemberContext(item, { loadDetails: false })
    if (!result) return
    setMemberDeleteOpen(true)
  }

  async function handleActionSuccess() {
    await fetchUsers({
      page: pagination.page,
      pageSize: pagination.pageSize,
      filters,
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Todos os usuários</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">
            {pagination.totalItems} no total
          </Badge>
          <Badge variant="outline" className="font-normal">
            {roleCounts.master} master · {roleCounts.manager} manager · {roleCounts.operator}{" "}
            operador
          </Badge>
        </div>
      </div>

      <LeadsFiltersLayout>
        <Input
          placeholder="Buscar por nome, e-mail ou telefone"
          value={localFilters.query}
          onChange={(event) => handleQueryChange(event.target.value)}
          className="h-8 w-65 lg:w-90"
        />
        <LeadsMultiFilter
          title="Papel"
          options={ROLE_OPTIONS.filter((option) => option.value !== "all")}
          selectedValues={localFilters.role === "all" ? [] : [localFilters.role]}
          onChange={handleRoleChange}
        />
        <LeadsMultiFilter
          title="Plano"
          options={PLAN_OPTIONS.filter((option) => option.value !== "all")}
          selectedValues={localFilters.plan === "all" ? [] : [localFilters.plan]}
          onChange={handlePlanChange}
        />
        {isFiltered ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 lg:px-3"
            onClick={() => void handleClear()}
            disabled={isLoading}
          >
            Limpar
            <X data-icon="inline-end" />
          </Button>
        ) : null}
      </LeadsFiltersLayout>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchUsers({ page: pagination.page })}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Funções</TableHead>
              <TableHead>Master vinculado</TableHead>
              <TableHead>Plano do master</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhum usuário encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.fullName || "Sem nome"}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>{maskPhone(item.phone ?? "") || "—"}</TableCell>
                  <TableCell>{getRoleBadge(item.role, item.isMaster)}</TableCell>
                  <TableCell>
                    {item.functions && item.functions.length > 0
                      ? item.functions.map((func) => func.label || func.name).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {item.isMaster ? "—" : item.master?.fullName || item.master?.id || "—"}
                  </TableCell>
                  <TableCell>{item.master ? item.master.plan.label : "—"}</TableCell>
                  <TableCell>{formatDate(item.createdAt, tz)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" disabled={actionLoadingId === item.id}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openUserSheet(item.id)}>
                          <Eye />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleOpenEdit(item)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        {!item.isMaster ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => void handleOpenDelete(item)}
                          >
                            <Trash2 />
                            Deletar conta
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Resultados por página</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                const nextPageSize = Number.parseInt(value, 10)
                if (Number.isFinite(nextPageSize)) {
                  void setUsersPageSize(nextPageSize)
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-23">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
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
              onClick={() => void setUsersPage(pagination.page - 1)}
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
              onClick={() => void setUsersPage(pagination.page + 1)}
              disabled={!pagination.hasNextPage || isLoading}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <BackofficeAllUsersDetailSheet />
      <BackofficeMemberEditDialog
        open={memberEditOpen}
        onOpenChange={setMemberEditOpen}
        member={selectedMember}
        details={selectedDetails}
        service={clientDetailsService}
        onSuccess={() => void handleActionSuccess()}
        onDeleteRequest={() => {
          setMemberEditOpen(false)
          setMemberDeleteOpen(true)
        }}
      />
      <BackofficeMemberDeleteDialog
        open={memberDeleteOpen}
        onOpenChange={setMemberDeleteOpen}
        member={selectedMember}
        service={clientDetailsService}
        onSuccess={() => void handleActionSuccess()}
      />
    </div>
  )
}