"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, Edit, FileText, MailCheck, MoreHorizontal, RefreshCw, Trash2, X } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useTimezone } from "@/app/context/TimezoneContext"
import { BackofficeAdhesionDialog } from "../components/BackofficeAdhesionDialog"
import { useBackofficeAdhesions } from "../context/BackofficeAdhesionsHook"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  BACKOFFICE_ADHESION_STATUS_LABELS,
  type BackofficeAdhesionCreationResult,
  type BackofficeAdhesionItem,
  type BackofficeAdhesionStatusKey,
} from "../context/BackofficeAdhesionsTypes"
import { formatIntimezone } from "@/lib/dates/formatters"
import { formatDocumentInput } from "@/lib/masks"

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50]

const STATUS_OPTIONS: { value: BackofficeAdhesionStatusKey; label: string }[] = Object.entries(
  BACKOFFICE_ADHESION_STATUS_LABELS
).map(([value, label]) => ({ value: value as BackofficeAdhesionStatusKey, label }))

function formatDate(value: string, tz: string): string {
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", tz)
  } catch {
    return value
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function getStatusBadgeClass(status: BackofficeAdhesionStatusKey): string {
  const classes: Record<BackofficeAdhesionStatusKey, string> = {
    pending: "border-primary/30 bg-primary/10 text-primary",
    paid: "border-primary/30 bg-primary/15 text-primary",
    overdue: "border-destructive/30 bg-destructive/10 text-destructive",
    expired: "border-muted bg-muted text-muted-foreground",
    canceled: "border-muted bg-muted text-muted-foreground",
  }
  return classes[status]
}

function isAdhesionInviteEnabled(adhesion: BackofficeAdhesionItem): boolean {
  return adhesion.accountProvisioned || adhesion.hasExternalActivation
}

function isAdhesionCheckoutLinkEnabled(adhesion: BackofficeAdhesionItem): boolean {
  return adhesion.status !== "paid" && !isAdhesionInviteEnabled(adhesion)
}

function isAdhesionInvoiceCheckoutEnabled(adhesion: BackofficeAdhesionItem): boolean {
  return adhesion.status !== "paid" && isAdhesionInviteEnabled(adhesion)
}

function getAdhesionFinancialStatusLabel(adhesion: BackofficeAdhesionItem): string {
  if (adhesion.status === "pending" && adhesion.accountProvisioned) {
    return "Ativa — parcelas em aberto"
  }
  if (adhesion.status === "pending" && !adhesion.accountProvisioned) {
    return "Aguardando pagamento"
  }
  return BACKOFFICE_ADHESION_STATUS_LABELS[adhesion.status]
}

export function BackofficeAdhesionsContainer() {
  const { tz } = useTimezone()
  const {
    adhesions,
    pagination,
    filters,
    isLoading,
    error,
    canManage,
    service,
    setFilters,
    fetchAdhesions,
    setAdhesionsPage,
    setAdhesionsPageSize,
    clearFilters,
  } = useBackofficeAdhesions()
  const [localFilters, setLocalFilters] = useState(filters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdhesion, setEditingAdhesion] = useState<BackofficeAdhesionItem | null>(null)
  const [resendResult, setResendResult] = useState<BackofficeAdhesionCreationResult | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [copyingInvoiceId, setCopyingInvoiceId] = useState<string | null>(null)
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BackofficeAdhesionItem | null>(null)

  const isFiltered = useMemo(
    () => localFilters.query.trim().length > 0 || localFilters.status !== "all",
    [localFilters.query, localFilters.status]
  )

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    const nextQuery = localFilters.query.trim()
    const currentQuery = filters.query.trim()
    if (nextQuery === currentQuery) return

    const debounceId = window.setTimeout(() => {
      void fetchAdhesions({ filters: localFilters, page: 1 })
    }, 300)

    return () => window.clearTimeout(debounceId)
  }, [fetchAdhesions, filters.query, localFilters])

  async function handleClear() {
    const cleared = { query: "", status: "all" as const }
    setLocalFilters(cleared)
    setFilters(cleared)
    await clearFilters()
  }

  function handleStatusChange(values: string[]) {
    const selected = values[values.length - 1]
    const next = (selected ?? "all") as BackofficeAdhesionStatusKey | "all"
    const updated = { ...localFilters, status: next }
    setLocalFilters(updated)
    setFilters(updated)
    void fetchAdhesions({ filters: updated, page: 1 })
  }

  async function handleResend(adhesion: BackofficeAdhesionItem) {
    if (resendingId) return
    setResendingId(adhesion.id)
    try {
      const result = await service.resend(adhesion.id)
      setResendResult(result)
      await fetchAdhesions({ page: pagination.page })
      toast.success("Link de adesão gerado")
    } catch (err) {
      console.error("[BackofficeAdhesionsContainer][resend]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar adesão")
    } finally {
      setResendingId(null)
    }
  }

  async function handleResendInvite(adhesion: BackofficeAdhesionItem) {
    if (resendingInviteId) return
    setResendingInviteId(adhesion.id)
    const toastId = toast.loading("Enviando convite...")
    try {
      await service.resendInvite(adhesion.id)
      toast.success("Convite reenviado com sucesso", { id: toastId })
    } catch (err) {
      console.error("[BackofficeAdhesionsContainer][resendInvite]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar convite", { id: toastId })
    } finally {
      setResendingInviteId(null)
    }
  }

  async function handleCopyPublicLink(adhesion: BackofficeAdhesionItem) {
    if (copyingId) return
    setCopyingId(adhesion.id)
    try {
      const result = await service.getPublicUrl(adhesion.id)
      await copyLink(result.publicUrl)
    } catch (err) {
      console.error("[BackofficeAdhesionsContainer][copyPublicUrl]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao copiar link de adesão")
    } finally {
      setCopyingId(null)
    }
  }

  async function handleCopyInvoiceLink(adhesion: BackofficeAdhesionItem) {
    if (copyingInvoiceId) return
    setCopyingInvoiceId(adhesion.id)
    try {
      const result = await service.getPendingInvoiceUrls(adhesion.id)
      const links = result.invoices.map((invoice) => invoice.invoiceUrl).join("\n")
      await copyLink(
        links,
        result.invoices.length > 1
          ? { toastMessage: `${result.invoices.length} links de fatura copiados` }
          : { toastMessage: "Link de fatura copiado" }
      )
    } catch (err) {
      console.error("[BackofficeAdhesionsContainer][copyInvoiceUrl]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao copiar link de fatura")
    } finally {
      setCopyingInvoiceId(null)
    }
  }

  async function handleDeletePending(adhesion: BackofficeAdhesionItem) {
    if (deletingId) return
    setDeletingId(adhesion.id)
    try {
      await service.deletePending(adhesion.id)
      toast.success("Adesão excluída")
      await fetchAdhesions({ page: pagination.page })
    } catch (err) {
      console.error("[BackofficeAdhesionsContainer][deletePending]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao excluir adesão")
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  async function copyLink(url: string, options?: { toastMessage?: string }) {
    await navigator.clipboard.writeText(url)
    toast.success(options?.toastMessage ?? "Link copiado")
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Nova adesão</h1>
          <p className="text-sm text-muted-foreground">
            Links públicos gerados a partir dos leads do CRM.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            onClick={() => {
              setEditingAdhesion(null)
              setDialogOpen(true)
            }}
          >
            Nova adesão
          </Button>
        )}
      </div>

      <LeadsFiltersLayout>
        <Input
          placeholder="Buscar por nome ou lead"
          value={localFilters.query}
          onChange={(event) =>
            setLocalFilters((current) => ({ ...current, query: event.target.value }))
          }
          className="h-8 w-65 lg:w-105"
        />
        <LeadsMultiFilter
          title="Status"
          options={STATUS_OPTIONS}
          selectedValues={localFilters.status === "all" ? [] : [localFilters.status]}
          onChange={handleStatusChange}
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

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Data da adesão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : adhesions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma adesão encontrada.
                </TableCell>
              </TableRow>
            ) : (
              adhesions.map((adhesion) => (
                <TableRow key={adhesion.id}>
                  <TableCell className="font-medium">{adhesion.fullName}</TableCell>
                  <TableCell>{adhesion.email}</TableCell>
                  <TableCell>{formatDocumentInput(adhesion.cpfCnpj)}</TableCell>
                  <TableCell>{formatDate(adhesion.expiresAt, tz)}</TableCell>
                  <TableCell>{formatDate(adhesion.createdAt, tz)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", getStatusBadgeClass(adhesion.status))}
                    >
                      {getAdhesionFinancialStatusLabel(adhesion)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {adhesion.paidAt
                      ? `Pago em ${formatDate(adhesion.paidAt, tz)}`
                      : getAdhesionFinancialStatusLabel(adhesion)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{formatCurrency(adhesion.totalAmount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {BACKOFFICE_ADHESION_CYCLE_LABELS[adhesion.cycle]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Abrir ações">
                          <MoreHorizontal data-icon="inline-start" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={adhesion.status === "paid"}
                            onSelect={() => {
                              setEditingAdhesion(adhesion)
                              setDialogOpen(true)
                            }}
                          >
                            <Edit data-icon="inline-start" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              resendingId === adhesion.id || !isAdhesionCheckoutLinkEnabled(adhesion)
                            }
                            onSelect={() => void handleResend(adhesion)}
                          >
                            <RefreshCw data-icon="inline-start" />
                            Reenviar adesão
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              copyingId === adhesion.id || !isAdhesionCheckoutLinkEnabled(adhesion)
                            }
                            onSelect={() => void handleCopyPublicLink(adhesion)}
                          >
                            <Copy data-icon="inline-start" />
                            Copiar link de adesão
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              copyingInvoiceId === adhesion.id ||
                              !isAdhesionInvoiceCheckoutEnabled(adhesion)
                            }
                            onSelect={() => void handleCopyInvoiceLink(adhesion)}
                          >
                            <FileText data-icon="inline-start" />
                            Copiar link de fatura
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              resendingInviteId === adhesion.id || !isAdhesionInviteEnabled(adhesion)
                            }
                            onSelect={() => void handleResendInvite(adhesion)}
                          >
                            <MailCheck data-icon="inline-start" />
                            Reenviar convite
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={adhesion.status !== "pending"}
                            onSelect={() => setDeleteTarget(adhesion)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Deletar adesão
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Resultados por página</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => void setAdhesionsPageSize(Number.parseInt(value, 10))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-23">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdhesionsPage(pagination.page - 1)}
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
            onClick={() => setAdhesionsPage(pagination.page + 1)}
            disabled={!pagination.hasNextPage || isLoading}
          >
            Próxima
          </Button>
        </div>
      </div>

      <BackofficeAdhesionDialog
        open={dialogOpen}
        mode={editingAdhesion ? "edit" : "create"}
        adhesion={editingAdhesion}
        service={service}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingAdhesion(null)
        }}
        onSaved={() => fetchAdhesions({ page: pagination.page })}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar adesão pendente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a adesão pendente e libera o lead para uma nova adesão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && void handleDeletePending(deleteTarget)}
              disabled={!deleteTarget || Boolean(deletingId)}
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {deletingId ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(resendResult)} onOpenChange={(open) => !open && setResendResult(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Link de adesão</DialogTitle>
            <DialogDescription>
              Envie este link para o cliente concluir o checkout.
            </DialogDescription>
          </DialogHeader>
          {resendResult?.publicUrl ? (
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              <div className="flex gap-2">
                <Input value={resendResult.publicUrl} readOnly />
                <Button type="button" size="icon" onClick={() => copyLink(resendResult.publicUrl!)}>
                  <Copy data-icon="inline-start" />
                  <span className="sr-only">Copiar link</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expira em {formatDate(resendResult.expiresAt, tz)}.
              </p>
            </div>
          ) : null}
          <DialogFooter className="border-t pt-4">
            <Button type="button" onClick={() => setResendResult(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}