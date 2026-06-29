'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserAssociated } from '@/app/api/v1/profiles/DTO/profileResponseDTO';

export interface CloserRequirementPayload {
  closerId: string;
}

interface CloserRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CloserRequirementPayload) => Promise<void>;
  closers: UserAssociated[];
  closersLoading?: boolean;
  closersError?: string | null;
  initialCloserId?: string | null;
  isSaving?: boolean;
  leadName?: string;
}

export function CloserRequirementDialog({
  open,
  onOpenChange,
  onSave,
  closers,
  closersLoading = false,
  closersError = null,
  initialCloserId = null,
  isSaving = false,
  leadName,
}: CloserRequirementDialogProps) {
  const [closerId, setCloserId] = useState('');

  useEffect(() => {
    if (!open) return;
    setCloserId(initialCloserId ?? '');
  }, [open, initialCloserId]);

  const handleSubmit = async () => {
    if (!closerId) {
      toast.error('Selecione o closer do time.');
      return;
    }

    await onSave({ closerId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Closer obrigatório</DialogTitle>
          <DialogDescription>
            {leadName
              ? `Selecione o closer responsável para continuar a movimentação do lead ${leadName}.`
              : 'Selecione o closer responsável para continuar a movimentação do lead.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Closer do time *</Label>
            <Select
              value={closerId}
              onValueChange={setCloserId}
              disabled={isSaving || closersLoading || closers.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    closersLoading
                      ? 'Carregando closers...'
                      : closers.length === 0
                        ? 'Nenhum closer disponível'
                        : 'Selecione o closer'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {closers.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>
                    {closer.name || closer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {closersError ? (
              <p className="text-xs text-destructive">{closersError}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving || closersLoading}>
            {isSaving ? 'Salvando...' : 'Salvar e continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
