"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import { cn } from "@/lib/utils"
import { EmailCreatorAttribution } from "@/components/email/EmailCreatorAttribution"
import type { StudioEmailContactList } from "../../services/IBackofficeStudioEmailService"
import type { UseBackofficeContatosReturn } from "../hooks/useBackofficeContatos"

type Props = Pick<
  UseBackofficeContatosReturn,
  | "lists"
  | "selectedListId"
  | "loadingLists"
  | "deletingListId"
  | "canManage"
  | "handleSelectList"
  | "handleDeleteList"
>

function ContactListItem({
  list,
  isSelected,
  canManage,
  deletingListId,
  onSelect,
  onDelete,
}: {
  list: StudioEmailContactList
  isSelected: boolean
  canManage: boolean
  deletingListId: string | null
  onSelect: () => void
  onDelete: () => Promise<void>
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await onDelete()
      setDeleteOpen(false)
    } catch {
      // toast handled in hook
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect()
        }}
        className={cn(
          "group flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors",
          isSelected
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground hover:bg-muted"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug">{list.name}</p>
          {list.description ? (
            <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
              {list.description}
            </p>
          ) : null}
          <EmailCreatorAttribution item={list} className="mt-0.5" />
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {list.totalContacts.toLocaleString("pt-BR")}
          </Badge>
          {canManage && !list.isSystemDefault && !list.isBlocklist ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteOpen(true)
              }}
              title="Excluir lista"
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting && !deletingListId) setDeleteOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista &quot;{list.name}&quot; e todos os seus contatos serão removidos
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting || deletingListId === list.id}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting || deletingListId === list.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting || deletingListId === list.id ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BackofficeContactListPanel({
  lists,
  selectedListId,
  loadingLists,
  deletingListId,
  canManage,
  handleSelectList,
  handleDeleteList,
}: Props) {
  if (loadingLists && lists.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (lists.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma lista criada ainda.</p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {lists.map((list) => (
        <ContactListItem
          key={list.id}
          list={list}
          isSelected={selectedListId === list.id}
          canManage={canManage}
          deletingListId={deletingListId}
          onSelect={() => handleSelectList(list.id)}
          onDelete={() => handleDeleteList(list.id)}
        />
      ))}
    </div>
  )
}
