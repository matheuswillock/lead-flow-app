"use client"

import { useState } from "react"
import { Loader2, MoreVertical, Upload, Users, Archive } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useBackofficeEmailContatos } from "../context/BackofficeEmailContatosHook"
import { CreateContactListDialog } from "../components/CreateContactListDialog"
import { UploadContactsDialog } from "../components/UploadContactsDialog"
import { ViewContactsDialog } from "../components/ViewContactsDialog"
import type { BackofficeEmailContactListItem } from "../context/BackofficeEmailContatosTypes"

export function BackofficeEmailContatosContainer() {
  const { contactLists, isLoading, error, archiveContactList } = useBackofficeEmailContatos()
  const [uploadTarget, setUploadTarget] = useState<BackofficeEmailContactListItem | null>(null)
  const [viewTarget, setViewTarget] = useState<BackofficeEmailContactListItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<BackofficeEmailContactListItem | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const showLoader = isLoading && contactLists.length === 0

  async function handleArchiveConfirm() {
    if (!archiveTarget) return
    setIsArchiving(true)
    try {
      await archiveContactList(archiveTarget.id)
    } finally {
      setIsArchiving(false)
      setArchiveTarget(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie listas de contatos usadas pelas campanhas de e-mail.
          </p>
        </div>
        <CreateContactListDialog />
      </div>

      {showLoader && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Carregando listas...
        </div>
      )}

      {!showLoader && error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!showLoader && !error && contactLists.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma lista de contatos criada ainda.
        </p>
      )}

      {!showLoader && !error && contactLists.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Contatos</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contactLists.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="font-medium">{list.name}</TableCell>
                <TableCell>
                  {list.isSystemDefault ? (
                    <Badge variant="secondary">Sistêmica</Badge>
                  ) : (
                    <Badge variant="outline">Importada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{list.totalContacts}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Ações">
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewTarget(list)}>
                        <Users data-icon="inline-start" />
                        Ver contatos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setUploadTarget(list)}>
                        <Upload data-icon="inline-start" />
                        Importar CSV/JSON
                      </DropdownMenuItem>
                      {!list.isSystemDefault && (
                        <DropdownMenuItem
                          onClick={() => setArchiveTarget(list)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Archive data-icon="inline-start" />
                          Arquivar lista
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UploadContactsDialog
        list={uploadTarget}
        onOpenChange={(open) => !open && setUploadTarget(null)}
      />
      <ViewContactsDialog list={viewTarget} onOpenChange={(open) => !open && setViewTarget(null)} />

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={isArchiving ? undefined : (open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista &quot;{archiveTarget?.name}&quot; será arquivada e não poderá mais ser usada em
              novas campanhas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleArchiveConfirm()
              }}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving ? "Arquivando..." : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
