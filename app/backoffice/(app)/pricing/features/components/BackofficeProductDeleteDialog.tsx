"use client"

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
import { useBackofficePricing } from "../context/BackofficePricingContext"

export function BackofficeProductDeleteDialog() {
  const {
    deleteDialogOpen,
    deleteProduct,
    isDeleting,
    closeDeleteDialog,
    confirmDelete,
  } = useBackofficePricing()

  return (
    <AlertDialog
      open={deleteDialogOpen}
      onOpenChange={(open) => !open && closeDeleteDialog()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteProduct
              ? `O produto "${deleteProduct.name}" será removido da precificação.`
              : "Este produto será removido da precificação."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isDeleting} onClick={() => void confirmDelete()}>
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
