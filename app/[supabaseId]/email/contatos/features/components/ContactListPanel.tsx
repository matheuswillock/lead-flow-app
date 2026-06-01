"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useContactsContext } from "../context/ContactsContext";
import type { ContactList } from "../context/ContatosTypes";

function ContactListItem({ list }: { list: ContactList }) {
  const { selectedListId, handleSelectList, handleDeleteList } =
    useContactsContext();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  const isSelected = selectedListId === list.id;
  const creatorLabel = list.creator?.fullName?.trim() || list.creator?.email || "—";

  async function confirmDelete() {
    setDeletingList(true);
    try {
      await handleDeleteList(list.id);
    } catch {
      // error toast handled in hook
    } finally {
      setDeletingList(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleSelectList(list.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleSelectList(list.id);
        }}
        className={cn(
          "group flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted text-foreground"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug">{list.name}</p>
          {list.description && (
            <p className="truncate text-xs text-muted-foreground leading-snug mt-0.5">
              {list.description}
            </p>
          )}
          <p className="truncate text-xs text-muted-foreground leading-snug mt-0.5">
            Criado por: {creatorLabel}
          </p>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {list.totalContacts.toLocaleString("pt-BR")}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteOpen(true);
            }}
            title="Excluir lista"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista <strong>&quot;{list.name}&quot;</strong> e todos os seus contatos serão
              excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingList}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletingList}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingList ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ContactListPanel() {
  const { lists, loadingLists } = useContactsContext();

  if (loadingLists && lists.length === 0) {
    return (
      <div className="space-y-1.5 px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!loadingLists && lists.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-sm text-muted-foreground">
        Nenhuma lista criada ainda.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {lists.map((list) => (
        <ContactListItem key={list.id} list={list} />
      ))}
    </div>
  );
}
