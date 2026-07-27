"use client"

import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useBackofficeApprovals } from "../context/BackofficeApprovalsContext"
import type {
  BackofficeDeletionRequestItem,
  BackofficeDeletionRequestSnapshot,
  BackofficeDeletionRequestStatus,
  BackofficeDeletionRequestType,
} from "../context/BackofficeApprovalsTypes"

function typeLabel(type: BackofficeDeletionRequestType) {
  return type === "USER_DELETE" ? "Usuário" : "Time"
}

function statusLabel(status: BackofficeDeletionRequestStatus) {
  switch (status) {
    case "pending":
      return "Pendente"
    case "approved":
      return "Aprovado"
    case "rejected":
      return "Rejeitado"
    case "cancelled":
      return "Cancelado"
    default:
      return status
  }
}

function statusVariant(status: BackofficeDeletionRequestStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "outline"
    case "approved":
      return "default"
    case "rejected":
      return "destructive"
    case "cancelled":
      return "secondary"
    default:
      return "secondary"
  }
}

function snapshotTarget(snapshot: BackofficeDeletionRequestSnapshot | null) {
  if (!snapshot) return { title: "—", subtitle: null as string | null }

  if (snapshot.email || snapshot.fullName) {
    return {
      title: snapshot.fullName ?? snapshot.email ?? "—",
      subtitle: snapshot.fullName ? snapshot.email ?? null : null,
    }
  }

  return {
    title: snapshot.name ?? "—",
    subtitle: snapshot.masterId ? `Master: ${snapshot.masterId}` : null,
  }
}

function approvedCount(item: BackofficeDeletionRequestItem) {
  return item.approvals.filter((approval) => approval.decision === "approved").length
}

function userAlreadyDecided(item: BackofficeDeletionRequestItem, profileId: string | undefined) {
  if (!profileId) return false
  return item.approvals.some((approval) => approval.approverProfileId === profileId)
}

export function BackofficeApprovalsContainer() {
  const { tz } = useTimezone()
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const {
    items,
    filters,
    isLoading,
    isDeciding,
    decidingRequestId,
    error,
    setFilters,
    decide,
  } = useBackofficeApprovals()

  async function handleDecision(
    requestId: string,
    decision: "approved" | "rejected",
    successMessage: string
  ) {
    if (isDeciding) return
    try {
      await decide(requestId, decision)
      toast.success(successMessage)
    } catch (err) {
      console.error("[BackofficeApprovalsContainer][handleDecision]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao registrar decisão")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Aprovações</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Solicitações de exclusão que exigem duas aprovações independentes antes da execução.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
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
              <TableHead>Tipo</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Aprovações</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const target = snapshotTarget(item.snapshot)
                const isPendingAction = isDeciding && decidingRequestId === item.id
                const showActions =
                  canManage &&
                  item.status === "pending" &&
                  !userAlreadyDecided(item, user?.profileId)

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(item.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{target.title}</span>
                        {target.subtitle ? (
                          <span className="text-xs text-muted-foreground">{target.subtitle}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.requestedByName ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{item.requestedByEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{item.reason ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-sm tabular-nums">
                        {approvedCount(item)}/2
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatIntimezone(new Date(item.createdAt), "dd/MM/yyyy HH:mm", tz)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {showActions ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDeciding}
                            onClick={() =>
                              void handleDecision(item.id, "approved", "Aprovação registrada")
                            }
                          >
                            {isPendingAction ? "Processando…" : "Aprovar"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isDeciding}
                            onClick={() =>
                              void handleDecision(item.id, "rejected", "Solicitação rejeitada")
                            }
                          >
                            Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
