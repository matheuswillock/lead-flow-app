"use client"

import { useEffect, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeEmailContatos } from "../context/BackofficeEmailContatosHook"
import type { BackofficeEmailContactItem, BackofficeEmailContactListItem } from "../context/BackofficeEmailContatosTypes"

const PAGE_SIZE = 25

interface Props {
  list: BackofficeEmailContactListItem | null
  onOpenChange(open: boolean): void
}

export function ViewContactsDialog({ list, onOpenChange }: Props) {
  const { listContacts, deleteContact } = useBackofficeEmailContatos()
  const [contacts, setContacts] = useState<BackofficeEmailContactItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!list) return
    setPage(1)
  }, [list])

  useEffect(() => {
    if (!list) return
    setIsLoading(true)
    listContacts(list.id, page, PAGE_SIZE)
      .then((result) => {
        setContacts(result.contacts)
        setTotal(result.total)
      })
      .finally(() => setIsLoading(false))
  }, [list, page, listContacts])

  async function handleDelete(contactId: string) {
    if (!list) return
    await deleteContact(list.id, contactId)
    setContacts((prev) => prev.filter((c) => c.id !== contactId))
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Dialog open={Boolean(list)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contatos — {list?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Carregando contatos...
            </div>
          ) : contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum contato nesta lista ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-mono text-xs">{contact.email}</TableCell>
                    <TableCell>{contact.name ?? "—"}</TableCell>
                    <TableCell>
                      {contact.isComplained ? (
                        <Badge variant="destructive">Denunciou</Badge>
                      ) : contact.isBounced ? (
                        <Badge variant="destructive">Bounce</Badge>
                      ) : contact.isUnsubscribed ? (
                        <Badge variant="secondary">Descadastrado</Badge>
                      ) : (
                        <Badge variant="outline">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="Remover contato"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages} ({total} contatos)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
