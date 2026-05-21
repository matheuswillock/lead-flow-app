"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Crown, Eye, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { useBackofficeAllUsers } from "../context/BackofficeAllUsersContext"
import type {
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

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

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

  function handleQueryChange(value: string) {
    setLocalFilters((prev) => ({ ...prev, query: value }))
  }

  function handleRoleChange(value: string) {
    const next = (value as BackofficeAllUsersRoleFilter | "all")
    const updated = { ...localFilters, role: next }
    setLocalFilters(updated)
    setFilters(updated)
    void fetchUsers({ filters: updated, page: 1 })
  }

  function handlePlanChange(value: string) {
    const next = (value as BackofficeAllUsersPlanFilter | "all")
    const updated = { ...localFilters, plan: next }
    setLocalFilters(updated)
    setFilters(updated)
    void fetchUsers({ filters: updated, page: 1 })
  }

  async function handleSearch() {
    setFilters(localFilters)
    await fetchUsers({ filters: localFilters, page: 1 })
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Todos os usuários</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">
            {pagination.totalItems} no total
          </Badge>
          <Badge variant="outline" className="font-normal">
            {roleCounts.master} master · {roleCounts.manager} manager · {roleCounts.operator} operador
          </Badge>
        </div>
      </div>

      <LeadsFiltersLayout>
        <Input
          placeholder="Buscar por nome, e-mail ou telefone"
          value={localFilters.query}
          onChange={(event) => handleQueryChange(event.target.value)}
          className="h-8 w-[260px] lg:w-[360px]"
        />
        <Select value={localFilters.role} onValueChange={handleRoleChange} disabled={isLoading}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={localFilters.plan} onValueChange={handlePlanChange} disabled={isLoading}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => void handleSearch()} disabled={isLoading}>
          <Search className="mr-1 h-4 w-4" />
          Buscar
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleClear()} disabled={isLoading}>
          Limpar
        </Button>
      </LeadsFiltersLayout>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <Button size="sm" variant="outline" onClick={() => void fetchUsers({ page: pagination.page })}>
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
              <TableHead>Master vinculado</TableHead>
              <TableHead>Plano do master</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ação</TableHead>
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
                    {item.isMaster
                      ? "—"
                      : item.master?.fullName || item.master?.id || "—"}
                  </TableCell>
                  <TableCell>{item.master ? item.master.plan.label : "—"}</TableCell>
                  <TableCell>{formatDate(item.createdAt, tz)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openUserSheet(item.id)}
                    >
                      <Eye />
                      Visualizar
                    </Button>
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
              <SelectTrigger className="h-8 w-[92px]">
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
    </div>
  )
}
