"use client"

import { useState } from "react"
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react"
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { Textarea } from "@/components/ui/textarea"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { useBackofficeAuthorizedSponsorsContext } from "../context/BackofficeAuthorizedSponsorsContext"
import type { AuthorizedSponsorItem } from "../context/BackofficeAuthorizedSponsorsTypes"

function formatDate(value: string | null, tz: string): string {
  if (!value) return "—"
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy", tz)
  } catch {
    return value
  }
}

export function BackofficeAuthorizedSponsorsContainer() {
  const { tz } = useTimezone()
  const {
    items,
    eligibleMasters,
    isLoading,
    error,
    isGranting,
    isRevokingId,
    fetchItems,
    grant,
    revoke,
  } = useBackofficeAuthorizedSponsorsContext()

  const [grantOpen, setGrantOpen] = useState(false)
  const [selectedMasterId, setSelectedMasterId] = useState("")
  const [notes, setNotes] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<AuthorizedSponsorItem | null>(null)

  const handleGrant = async () => {
    if (!selectedMasterId) {
      toast.error("Selecione um master")
      return
    }
    const ok = await grant(selectedMasterId, notes.trim() || null)
    if (ok) {
      toast.success("Patrocinador autorizado")
      setGrantOpen(false)
      setSelectedMasterId("")
      setNotes("")
    } else {
      toast.error("Não foi possível autorizar o patrocinador")
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    const ok = await revoke(revokeTarget.id)
    if (ok) {
      toast.success("Autorização revogada")
      setRevokeTarget(null)
    } else {
      toast.error("Não foi possível revogar a autorização")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Patrocinadores autorizados</h1>
          <p className="text-sm text-muted-foreground">
            Masters que podem patrocinar contas Associado e Convidado
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchItems()} disabled={isLoading}>
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
          <Button onClick={() => setGrantOpen(true)} disabled={eligibleMasters.length === 0}>
            <Plus data-icon="inline-start" />
            Autorizar
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Contas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum patrocinador autorizado
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.fullName ?? "—"}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>{item.sponsoredAccountsCount}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Ativo" : "Revogado"}
                    </Badge>
                    {!item.isActive && item.revokedBy ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        revogado por {item.revokedBy.fullName ?? item.revokedBy.email} em{" "}
                        {formatDate(item.revokedAt, tz)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(item.grantedAt, tz)}</TableCell>
                  <TableCell>
                    {item.isActive ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={isRevokingId === item.id}
                            onClick={() => setRevokeTarget(item)}
                          >
                            Revogar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Autorizar patrocinador</DialogTitle>
            <DialogDescription>
              Conceda permissão para um master patrocinar contas Associado e Convidado.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Master</FieldLabel>
                <Select value={selectedMasterId} onValueChange={setSelectedMasterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um master" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMasters.map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        {master.fullName ?? master.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Observações</FieldLabel>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Opcional"
                  rows={3}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleGrant()} disabled={isGranting || !selectedMasterId}>
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revogar autorização de {revokeTarget?.fullName ?? revokeTarget?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.sponsoredAccountsCount ?? 0} conta(s) patrocinada(s) ativa(s) será(ão)
              preservada(s); novas associações com este patrocinador serão bloqueadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevoke()}
              disabled={Boolean(isRevokingId)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
