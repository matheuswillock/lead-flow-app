"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RENEWAL_STATUS_LABELS,
  type RenewalStatus,
} from '../context/CarteiraTypes';

const STATUS_DOT_BG: Record<RenewalStatus, string> = {
  to_renew:  'bg-primary',
  contacted: 'bg-blue-500',
  proposal:  'bg-semantic-warning',
  renewed:   'bg-semantic-success',
  lost:      'bg-semantic-danger',
};

interface RenewalStatusButtonProps {
  portfolioId: string;
  value: RenewalStatus;
  onStatusChange: (portfolioId: string, status: RenewalStatus) => void;
}

export function RenewalStatusButton({ portfolioId, value, onStatusChange }: RenewalStatusButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selection, setSelection] = useState<RenewalStatus>(value);

  useEffect(() => {
    if (dialogOpen) setSelection(value);
  }, [dialogOpen, value]);

  const handleConfirm = () => {
    if (selection !== value) {
      onStatusChange(portfolioId, selection);
    }
    setDialogOpen(false);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
        <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_BG[value])} />
        {RENEWAL_STATUS_LABELS[value]}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-105">
          <DialogHeader>
            <DialogTitle>Alterar status</DialogTitle>
            <DialogDescription>
              Selecione o novo status da renovação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={selection} onValueChange={(v) => setSelection(v as RenewalStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RENEWAL_STATUS_LABELS) as RenewalStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className="flex items-center gap-2">
                        <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_BG[status])} />
                        {RENEWAL_STATUS_LABELS[status]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={selection === value}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
