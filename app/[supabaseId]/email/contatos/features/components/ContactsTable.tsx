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

function ContactStatusBadge({ contact }: { contact: Contact }) {
  if (contact.isComplained) return <Badge variant="destructive">Reclamação</Badge>
  if (contact.isBounced) return <Badge variant="destructive">Bounce</Badge>
  if (contact.isUnsubscribed) return <Badge variant="secondary">Descadastrado</Badge>
  return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border-0">Ativo</Badge>
}

function DeleteContactDialog({ contact, onConfirm }: { contact: Contact; onConfirm: () => Promise<void> }) {
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Deletar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do contato</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{contact.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p className="font-medium">{contact.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <div className="pt-1">
                <ContactStatusBadge contact={contact} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  )
}

export function ContactsTable() {
  const { tz } = useTimezone()
  const {
    contacts,
    totalContacts: total,
    page,
    totalPages,
    search,
    loadingContacts,
    handleSearch,
    handlePageChange,
    handleDeleteContact,
  } = useContactsContext()

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum contato encontrado para esta busca" : "Nenhum contato nesta lista ainda"}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-mono text-sm">{contact.email}</TableCell>
                  <TableCell className="text-sm">{contact.name ?? "—"}</TableCell>
                  <TableCell><ContactStatusBadge contact={contact} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatIntimezone(new Date(contact.createdAt), "dd/MM/yyyy", tz)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteContactDialog
                      contact={contact}
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
