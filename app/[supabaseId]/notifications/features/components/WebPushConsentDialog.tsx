"use client";

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
import { Button } from "@/components/ui/button";

type WebPushConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  onAccept: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
};

export function WebPushConsentDialog({
  open,
  onOpenChange,
  isLoading = false,
  onAccept,
  onDismiss,
  onDecline,
}: WebPushConsentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ativar notificações no navegador?</AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            <span>
              Receba alertas de leads, tarefas e reuniões mesmo com o Corretor Studio fechado ou em
              segundo plano.
            </span>
            <span>
              Você pode alterar essa preferência a qualquer momento em Notificações → Configurar.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <AlertDialogAction
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault();
              void onAccept();
            }}
          >
            Ativar
          </AlertDialogAction>
          <AlertDialogCancel
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault();
              void onDismiss();
            }}
          >
            Agora não
          </AlertDialogCancel>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={isLoading}
            onClick={() => {
              void onDecline();
            }}
          >
            Não perguntar novamente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
