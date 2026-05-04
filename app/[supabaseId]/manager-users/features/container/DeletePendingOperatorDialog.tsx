'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeletePendingOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorName: string;
  operatorEmail: string;
  onConfirm: () => void;
}

export function DeletePendingOperatorDialog({
  open,
  onOpenChange,
  operatorName,
  operatorEmail,
  onConfirm,
}: DeletePendingOperatorDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>⚠️ Ação Irreversível</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Você está prestes a <strong className="text-destructive">deletar permanentemente</strong> o operador pendente:
            </span>
            <span className="block bg-muted p-3 rounded-md space-y-1">
              <span className="block font-medium">{operatorName}</span>
              <span className="block text-sm text-muted-foreground">{operatorEmail}</span>
            </span>
            <span className="block text-destructive font-medium pt-2">
              Esta ação não pode ser desfeita. Todos os dados relacionados a este operador pendente serão removidos da base de dados.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sim, deletar permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
