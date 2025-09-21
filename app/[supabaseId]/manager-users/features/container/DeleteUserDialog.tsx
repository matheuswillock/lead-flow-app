"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManagerUser } from "../types";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  user?: ManagerUser | null;
  loading?: boolean;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  onConfirm,
  user,
  loading = false,
}: DeleteUserDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Remover Usuário</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Tem certeza de que deseja remover o usuário{" "}
              <span className="font-semibold">{user.name}</span>?
            </p>
            <p className="text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. O usuário será permanentemente
              removido do sistema e perderá acesso a todas as funcionalidades.
            </p>
            {user.role === "manager" && (
              <p className="text-sm text-orange-600 dark:text-orange-400">
                ⚠️ Atenção: Este usuário é um Manager e pode ter operators
                associados.
              </p>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Removendo..." : "Remover Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}