'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Lead } from '../context/PipelineTypes';
import { ScheduleMeetingDialog } from '@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog';
import { FinalizeContractDialog, FinalizeContractData } from '@/app/[supabaseId]/board/features/container/FinalizeContractDialog';

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  statusLabels: Record<string, string>;
  onStatusChanged: () => Promise<void>;
}

export function ChangeStatusDialog({
  open,
  onOpenChange,
  lead,
  statusLabels,
  onStatusChanged,
}: ChangeStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setSelectedStatus(newStatus);

    // Se for agendamento, abrir dialog de agendamento
    if (newStatus === 'scheduled') {
      onOpenChange(false);
      setShowScheduleDialog(true);
      return;
    }

    // Se for finalização, abrir dialog de finalização
    if (newStatus === 'contract_finalized') {
      onOpenChange(false);
      setShowFinalizeDialog(true);
      return;
    }

    // Para outros status, atualizar diretamente
    await updateLeadStatus(newStatus);
  };

  const updateLeadStatus = async (newStatus: string) => {
    if (!lead) return;

    const loadingToast = toast.loading('Atualizando status...');

    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      toast.success('Status atualizado com sucesso!', { id: loadingToast });
      onOpenChange(false);
      await onStatusChanged();
    } catch (error) {
      toast.error('Erro ao atualizar status', { id: loadingToast });
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleScheduleSuccess = async () => {
    setShowScheduleDialog(false);
    await onStatusChanged();
  };

  const handleFinalizeContract = async (data: FinalizeContractData) => {
    if (!lead) return;

    const response = await fetch(`/api/v1/leads/${lead.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Erro ao finalizar contrato');
    }

    setShowFinalizeDialog(false);
    await onStatusChanged();
  };

  if (!lead) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mudar Status do Lead</DialogTitle>
            <DialogDescription>
              Altere o status de <strong>{lead.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Novo Status</Label>
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Agendamento */}
      {lead && (
        <ScheduleMeetingDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          lead={lead}
          onScheduleSuccess={handleScheduleSuccess}
        />
      )}

      {/* Dialog de Finalização */}
      {lead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={setShowFinalizeDialog}
          leadName={lead.name}
          onFinalize={handleFinalizeContract}
        />
      )}
    </>
  );
}
