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
import {
  ScheduleMeetingDialog,
  type ScheduleMeetingSuccessPayload,
} from '@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog';
import { FinalizeContractDialog, FinalizeContractData } from '@/app/[supabaseId]/board/features/container/FinalizeContractDialog';
import { LeadStatusTriggerDialog, type LeadStatusTriggerPayload } from '@/app/[supabaseId]/board/features/container/LeadStatusTriggerDialog';
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
import { UserAssociated } from '@/app/api/v1/profiles/DTO/profileResponseDTO';
import { useParams } from 'next/navigation';
import { useTeamContext } from '@/app/context/TeamContext';

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  statusLabels: Record<string, string>;
  onStatusChanged: (leadId: string, patch: Partial<Lead>) => void | Promise<void>;
  closers: UserAssociated[];
  teamMembers?: UserAssociated[];
  onSchedulePatched?: (payload: ScheduleMeetingSuccessPayload) => void;
}

type PendingConfirmation = {
  status: string;
  confirmationRuleId: string;
  message: string;
};

const needsTriggerDialog = (status: string) =>
  status === 'future_sale' || status === 'opportunityLost' || status === 'operator_denied';

export function ChangeStatusDialog({
  open,
  onOpenChange,
  lead,
  statusLabels,
  onStatusChanged,
  closers,
  teamMembers,
  onSchedulePatched,
}: ChangeStatusDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showStatusTriggerDialog, setShowStatusTriggerDialog] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const updateLeadStatus = async (
    newStatus: string,
    trigger?: {
      followUpAt?: string;
      followUpNotes?: string;
      reason?: string;
      reasonDetails?: string;
      confirmRuleId?: string;
    },
    allowAutoConfirmation = false
  ) => {
    if (!lead) return false;

    const loadingToast = toast.loading('Atualizando status...');

    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseId ? { 'x-supabase-user-id': supabaseId } : {}),
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify({
          status: newStatus,
          ...(trigger ? { trigger } : {}),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.isValid) {
        const requiresConfirmation = !!result?.result?.requiresConfirmation;
        const confirmationRuleId =
          typeof result?.result?.confirmationRuleId === 'string'
            ? result.result.confirmationRuleId
            : null;
        const confirmationMessage =
          result?.errorMessages?.[0] ||
          'Confirmação adicional é necessária para concluir esta transição.';

        if (requiresConfirmation && confirmationRuleId) {
          if (allowAutoConfirmation) {
            return updateLeadStatus(
              newStatus,
              {
                ...(trigger ?? {}),
                confirmRuleId: confirmationRuleId,
              },
              false
            );
          }

          setPendingConfirmation({
            status: newStatus,
            confirmationRuleId,
            message: confirmationMessage,
          });
          toast.info(confirmationMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        throw new Error(result?.errorMessages?.[0] || 'Erro ao atualizar status');
      }

      const payload =
        result.result && typeof result.result === 'object'
          ? (result.result as Partial<Lead>)
          : {};
      await onStatusChanged(lead.id, {
        ...payload,
        status: newStatus as Lead['status'],
      });
      toast.success('Status atualizado com sucesso!', { id: loadingToast });
      onOpenChange(false);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar status', {
        id: loadingToast,
      });
      console.error('Erro ao atualizar status:', error);
      return false;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSelectedStatus(newStatus);
    setPendingConfirmation(null);

    if (newStatus === 'scheduled') {
      onOpenChange(false);
      setShowScheduleDialog(true);
      return;
    }

    if (newStatus === 'contract_finalized') {
      onOpenChange(false);
      setShowFinalizeDialog(true);
      return;
    }

    if (needsTriggerDialog(newStatus)) {
      onOpenChange(false);
      setShowStatusTriggerDialog(true);
      return;
    }

    await updateLeadStatus(newStatus);
  };

  const handleScheduleSuccess = async (payload?: ScheduleMeetingSuccessPayload) => {
    if (payload) {
      onSchedulePatched?.(payload);
    }
    setShowScheduleDialog(false);
  };

  const handleFinalizeContract = async (data: FinalizeContractData) => {
    if (!lead) return;

    const response = await fetch(`/api/v1/leads/${lead.id}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(supabaseId ? { 'x-supabase-user-id': supabaseId } : {}),
        ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
      },
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.isValid) {
      throw new Error(result?.errorMessages?.[0] || 'Erro ao finalizar contrato');
    }

    const leadPatch =
      result?.result && typeof result.result === 'object' && result.result.lead
        ? (result.result.lead as Partial<Lead>)
        : {};
    await onStatusChanged(lead.id, {
      ...leadPatch,
      status: 'contract_finalized',
    });
    setShowFinalizeDialog(false);
  };

  const handleStatusTriggerConfirm = async (payload: LeadStatusTriggerPayload) => {
    if (!selectedStatus) return;

    if (payload.kind === 'future_sale') {
      await updateLeadStatus(
        selectedStatus,
        {
          followUpAt: payload.followUpAt,
          followUpNotes: payload.followUpNotes,
          confirmRuleId: payload.confirmRuleId,
        },
        true
      );
    } else {
      await updateLeadStatus(
        selectedStatus,
        {
          reason: payload.reason,
          reasonDetails: payload.reasonDetails,
          confirmRuleId: payload.confirmRuleId,
        },
        true
      );
    }

    setShowStatusTriggerDialog(false);
  };

  const handleConfirmCombinedRule = async () => {
    if (!pendingConfirmation) return;

    const updated = await updateLeadStatus(
      pendingConfirmation.status,
      { confirmRuleId: pendingConfirmation.confirmationRuleId },
      false
    );

    if (updated) {
      setPendingConfirmation(null);
    }
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

      {lead && (
        <ScheduleMeetingDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          lead={lead}
          onScheduleSuccess={handleScheduleSuccess}
          closers={closers}
          teamMembers={teamMembers}
          mode="create"
        />
      )}

      {lead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={setShowFinalizeDialog}
          leadName={lead.name}
          onFinalize={handleFinalizeContract}
        />
      )}

      {lead && selectedStatus && needsTriggerDialog(selectedStatus) && (
        <LeadStatusTriggerDialog
          open={showStatusTriggerDialog}
          onOpenChange={setShowStatusTriggerDialog}
          mode={selectedStatus === 'future_sale' ? 'future_sale' : 'loss_reason'}
          leadName={lead.name}
          statusLabel={statusLabels[selectedStatus] || selectedStatus}
          confirmationMessage={pendingConfirmation?.message || null}
          confirmationRuleId={pendingConfirmation?.confirmationRuleId || null}
          onConfirm={handleStatusTriggerConfirm}
        />
      )}

      <AlertDialog
        open={!!pendingConfirmation && !needsTriggerDialog(pendingConfirmation.status)}
        onOpenChange={(open) => {
          if (!open) setPendingConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação necessária</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirmation?.message || 'Deseja confirmar esta mudança de status?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              void handleConfirmCombinedRule();
            }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

