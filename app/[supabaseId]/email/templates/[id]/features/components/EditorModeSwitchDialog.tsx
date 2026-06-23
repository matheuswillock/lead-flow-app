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
import { Spinner } from "@/components/ui/spinner";
import type { EditorMode } from "./EditorStudioTypes";

interface EditorModeSwitchDialogProps {
  open: boolean;
  targetMode: EditorMode | null;
  switching: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function EditorModeSwitchDialog({
  open,
  targetMode,
  switching,
  onOpenChange,
  onConfirm,
}: EditorModeSwitchDialogProps) {
  const isHtmlTarget = targetMode === "html";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isHtmlTarget ? "Mudar para modo HTML?" : "Mudar para modo blocos?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isHtmlTarget ? (
              <>
                Você passará a editar o código-fonte do e-mail diretamente. Ao alternar de volta para
                blocos, estruturas ou estilos complexos podem não ser preservados exatamente.
              </>
            ) : (
              <>
                O HTML atual será importado no editor visual. Estilos avançados ou marcações
                específicas podem ser simplificados durante a importação.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={switching}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={switching}>
            {switching ? <Spinner data-icon="inline-start" /> : null}
            {switching ? "Alternando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
