"use client"

import { useState } from "react"
import Link from "next/link"
import { ShieldBan } from "lucide-react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import { useBackofficeAnathemas } from "../context/BackofficeAnathemasContext"
import { LiftBanDialog } from "../components/LiftBanDialog"

function scopeLabel(scope: "INDIVIDUAL" | "ACCOUNT") {
  return scope === "ACCOUNT" ? "Conta" : "Individual"
}

export function BackofficeAnathemasContainer() {
  const { tz } = useTimezone()
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const {
    items,
    filters,
    pagination,
    isLoading,
    isLifting,
    error,
    setFilters,
    setPage,
    liftBan,
  } = useBackofficeAnathemas()
  const [liftTargetId, setLiftTargetId] = useState<string | null>(null)

  async function handleLiftConfirm(liftReason?: string | null) {
    if (!liftTargetId || isLifting) return
    try {
      await liftBan(liftTargetId, liftReason)
      toast.success("Banimento removido com sucesso")
      setLiftTargetId(null)
    } catch (err) {
      console.error("[BackofficeAnathemasContainer][handleLiftConfirm]", err)
      toastUserError(err)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ShieldBan className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Anatemas</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Usuários banidos da plataforma. Banimentos de conta bloqueiam o acesso dos membros vinculados sem banir cada um no Supabase.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nome ou e-mail"
          value={filters.query}
          onChange={(event) => setFilters({ query: event.target.value })}
          className="sm:max-w-sm"
        />
        <Select
          value={filters.status}
          onValueChange={(value) =>
            setFilters({ status: value as typeof filters.status })
          }
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Ativos</SelectItem>
            <SelectItem value="LIFTED">Removidos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Banido por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum banimento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{item.fullName ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{item.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{scopeLabel(item.scope)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{item.reason ?? "—"}</TableCell>
                  <TableCell>{item.bannedBy.fullName ?? item.bannedBy.email}</TableCell>
                  <TableCell>{formatIntimezone(new Date(item.bannedAt), "dd/MM/yyyy HH:mm", tz)}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "ACTIVE" ? "destructive" : "secondary"}>
                      {item.status === "ACTIVE" ? "Ativo" : "Removido"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "ACTIVE" && canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLifting}
                        onClick={() => setLiftTargetId(item.id)}
                      >
                        Desbanir
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href="/backoffice/clients/all-users">Ver usuários</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página {pagination.page} de {pagination.totalPages} · {pagination.totalItems} registro(s)
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.hasPreviousPage || isLoading}
            onClick={() => setPage(pagination.page - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.hasNextPage || isLoading}
            onClick={() => setPage(pagination.page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <LiftBanDialog
        open={liftTargetId !== null}
        isSubmitting={isLifting}
        onOpenChange={(open) => {
          if (!open) setLiftTargetId(null)
        }}
        onConfirm={handleLiftConfirm}
      />
    </div>
  )
}
