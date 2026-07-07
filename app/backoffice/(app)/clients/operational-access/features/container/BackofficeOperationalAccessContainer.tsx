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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { useBackofficeOperationalAccessContext } from "../context/BackofficeOperationalAccessContext"
import type { OperationalAccessGrantItem } from "../context/BackofficeOperationalAccessTypes"

function formatDate(value: string | null, tz: string): string {
  if (!value) return "—"
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy", tz)
  } catch {
    return value
  }
}

function GrantActions({
  item,
  isRevokingId,
  onRevoke,
}: {
  item: OperationalAccessGrantItem
  isRevokingId: string | null
  onRevoke: (item: OperationalAccessGrantItem) => void
}) {
  if (!item.isActive) return null

  return (
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
          onClick={() => onRevoke(item)}
        >
          Revogar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BackofficeOperationalAccessContainer() {
  const { tz } = useTimezone()
  const {
    associadosQueue,
    multiskillOrigins,
    eligibleAssociadosProfiles,
    eligibleMultiskillMasters,
    isLoading,
    error,
    isGrantingAssociados,
    isGrantingMultiskill,
    isRevokingId,
    fetchItems,
    grantAssociados,
    grantMultiskill,
    revoke,
  } = useBackofficeOperationalAccessContext()

  const [associadosGrantOpen, setAssociadosGrantOpen] = useState(false)
  const [multiskillGrantOpen, setMultiskillGrantOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [selectedMasterId, setSelectedMasterId] = useState("")
  const [notes, setNotes] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<OperationalAccessGrantItem | null>(null)

  const handleGrantAssociados = async () => {
    if (!selectedProfileId) {
      toast.error("Selecione um perfil")
      return
    }
    const ok = await grantAssociados(selectedProfileId, notes.trim() || null)
    if (ok) {
      toast.success("Acesso à fila Associados concedido")
      setAssociadosGrantOpen(false)
      setSelectedProfileId("")
      setNotes("")
    } else {
      toast.error("Não foi possível conceder o acesso")
    }
  }

  const handleGrantMultiskill = async () => {
    if (!selectedMasterId) {
      toast.error("Selecione uma conta")
      return
    }
    const ok = await grantMultiskill(selectedMasterId, notes.trim() || null)
    if (ok) {
      toast.success("Conta MultiSkill autorizada")
      setMultiskillGrantOpen(false)
      setSelectedMasterId("")
      setNotes("")
    } else {
      toast.error("Não foi possível autorizar a conta")
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
          <h1 className="text-2xl font-semibold tracking-tight">Acessos operacionais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie quem acessa a fila Associados e quais contas podem originar transferências MultiSkill
          </p>
        </div>
        <Button variant="outline" onClick={() => void fetchItems()} disabled={isLoading}>
          <RefreshCw data-icon="inline-start" />
          Atualizar
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Tabs defaultValue="associados">
        <TabsList>
          <TabsTrigger value="associados">Fila Associados</TabsTrigger>
          <TabsTrigger value="multiskill">Origem MultiSkill</TabsTrigger>
        </TabsList>

        <TabsContent value="associados" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => setAssociadosGrantOpen(true)} disabled={eligibleAssociadosProfiles.length === 0}>
              <Plus data-icon="inline-start" />
              Adicionar perfil
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {associadosQueue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum perfil autorizado
                    </TableCell>
                  </TableRow>
                ) : (
                  associadosQueue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.profile?.fullName ?? "—"}</TableCell>
                      <TableCell>{item.profile?.email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Ativo" : "Revogado"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.grantedAt, tz)}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.notes ?? "—"}</TableCell>
                      <TableCell>
                        <GrantActions item={item} isRevokingId={isRevokingId} onRevoke={setRevokeTarget} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="multiskill" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => setMultiskillGrantOpen(true)} disabled={eligibleMultiskillMasters.length === 0}>
              <Plus data-icon="inline-start" />
              Adicionar conta
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Time MultiSkill</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {multiskillOrigins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhuma conta autorizada
                    </TableCell>
                  </TableRow>
                ) : (
                  multiskillOrigins.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.team?.master.fullName ?? "—"}</TableCell>
                      <TableCell>{item.team?.master.email ?? "—"}</TableCell>
                      <TableCell>{item.team?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Ativo" : "Revogado"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.grantedAt, tz)}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.notes ?? "—"}</TableCell>
                      <TableCell>
                        <GrantActions item={item} isRevokingId={isRevokingId} onRevoke={setRevokeTarget} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={associadosGrantOpen} onOpenChange={setAssociadosGrantOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar perfil — Fila Associados</DialogTitle>
            <DialogDescription>
              Conceda acesso à fila de propostas Associados para um master.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Perfil (master)</FieldLabel>
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um master" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleAssociadosProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.fullName || profile.email}
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
            <Button variant="outline" onClick={() => setAssociadosGrantOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleGrantAssociados()}
              disabled={isGrantingAssociados || !selectedProfileId}
            >
              Conceder acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={multiskillGrantOpen} onOpenChange={setMultiskillGrantOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar conta — Origem MultiSkill</DialogTitle>
            <DialogDescription>
              O time MultiSkill será criado automaticamente na conta se ainda não existir.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel>Conta (master)</FieldLabel>
                <Select value={selectedMasterId} onValueChange={setSelectedMasterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMultiskillMasters.map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        {master.fullName || master.email}
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
            <Button variant="outline" onClick={() => setMultiskillGrantOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleGrantMultiskill()}
              disabled={isGrantingMultiskill || !selectedMasterId}
            >
              Autorizar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar esta autorização?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso operacional será desativado. Times e dados existentes não serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRevoke()} disabled={Boolean(isRevokingId)}>
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
