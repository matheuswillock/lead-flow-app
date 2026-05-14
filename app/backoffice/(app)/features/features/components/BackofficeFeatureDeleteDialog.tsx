"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useBackofficeFeature } from "../context/BackofficeFeatureContext"

export function BackofficeFeatureDeleteDialog() {
  const { deleteDialogOpen, deleteFeature, isDeleting, closeDeleteDialog, confirmDelete } =
    useBackofficeFeature()

  return (
    <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) closeDeleteDialog() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir funcionalidade</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a funcionalidade{" "}
            <span className="font-medium text-foreground">{deleteFeature?.name}</span>
            {" "}(<span className="font-mono text-xs">{deleteFeature?.slug}</span>)?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
