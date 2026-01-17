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
            <p>
              Você está prestes a <strong className="text-destructive">deletar permanentemente</strong> o operador pendente:
            </p>
            <div className="bg-muted p-3 rounded-md space-y-1">
              <p className="font-medium">{operatorName}</p>
              <p className="text-sm text-muted-foreground">{operatorEmail}</p>
            </div>
            <p className="text-destructive font-medium pt-2">
              Esta ação não pode ser desfeita. Todos os dados relacionados a este operador pendente serão removidos da base de dados.
            </p>
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
