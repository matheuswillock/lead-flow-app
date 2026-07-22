"use client"

import { useState } from "react"
import { Eye, MoreHorizontal, Search, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useContactsContext } from "../context/ContactsContext"
import type { Contact } from "../context/ContatosTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"

function ContactStatusBadge({ contact, isBlocklist }: { contact: Contact; isBlocklist?: boolean }) {
  if (isBlocklist || contact.isUnsubscribed) {
    return <Badge variant="secondary">Bloqueado</Badge>
  }
  if (contact.isComplained) return <Badge variant="destructive">Reclamação</Badge>
  if (contact.isBounced) return <Badge variant="destructive">Bounce</Badge>
  return <Badge className="border-semantic-success-border bg-semantic-success-surface text-semantic-success hover:bg-semantic-success-surface">Ativo</Badge>
}

function UnsubscribeSourceCell({ contact }: { contact: Contact }) {
  const source = contact.unsubscribeSource
  if (!source) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm font-medium">
        {source.campaignName ?? "Campanha não identificada"}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {source.subject ?? "Assunto indisponível"}
      </span>
    </div>
  )
}

function DeleteContactDialog({
  contact,
  onConfirm,
  readOnly,
  showUnsubscribeSource,
}: {
  contact: Contact
  onConfirm: () => Promise<void>
  readOnly?: boolean
  showUnsubscribeSource?: boolean
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            title="Abrir menu"
          >
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setViewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>
          {!readOnly ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do contato</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 flex flex-col gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">E-mail</p>
              <p className="font-medium">{contact.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p className="font-medium">{contact.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <div className="pt-1">
                <ContactStatusBadge contact={contact} isBlocklist={readOnly} />
              </div>
            </div>
            {showUnsubscribeSource ? (
              <>
                <div>
                  <p className="text-muted-foreground">Campanha do descadastro</p>
                  <p className="font-medium">
                    {contact.unsubscribeSource?.campaignName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">E-mail enviado</p>
                  <p className="font-medium">
                    {contact.unsubscribeSource?.subject ?? "—"}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {!readOnly ? (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover contato?</AlertDialogTitle>
              <AlertDialogDescription>
                O contato <strong>{contact.email}</strong> será removido desta lista.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Removendo..." : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  )
}

export function ContactsTable() {
  const { tz } = useTimezone()
  const {
    contacts,
    lists,
    selectedListId,
    totalContacts: total,
    page,
    totalPages,
    search,
    loadingContacts,
    handleSearch,
    handlePageChange,
    handleDeleteContact,
  } = useContactsContext()

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null
  const isBlocklist = Boolean(selectedList?.isBlocklist)
  const columnCount = isBlocklist ? 6 : 5

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por e-mail ou nome..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              {isBlocklist ? <TableHead>Campanha / e-mail</TableHead> : null}
              <TableHead>Adicionado em</TableHead>
              <TableHead className="w-10 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingContacts ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  {isBlocklist ? (
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                  ) : null}
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-12 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum contato encontrado para esta busca" : "Nenhum contato nesta lista ainda"}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-mono text-sm">{contact.email}</TableCell>
                  <TableCell className="text-sm">{contact.name ?? "—"}</TableCell>
                  <TableCell>
                    <ContactStatusBadge contact={contact} isBlocklist={isBlocklist} />
                  </TableCell>
                  {isBlocklist ? (
                    <TableCell className="max-w-64">
                      <UnsubscribeSourceCell contact={contact} />
                    </TableCell>
                  ) : null}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatIntimezone(new Date(contact.createdAt), "dd/MM/yyyy", tz)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteContactDialog
                      contact={contact}
                      readOnly={isBlocklist}
                      showUnsubscribeSource={isBlocklist}
                      onConfirm={() => handleDeleteContact(contact.id)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString("pt-BR")} contato(s)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loadingContacts}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </Button>
          <span>
            {page} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loadingContacts}
            onClick={() => handlePageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  )
}
