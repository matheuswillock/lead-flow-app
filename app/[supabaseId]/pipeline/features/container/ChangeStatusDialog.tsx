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
import { MeetingHealdBlockedDialog, MeetingHealdConfirmDialog } from '@/app/[supabaseId]/components/MeetingHealdGateDialog';
import {
  SalesInfoRequirementDialog,
  type MissingSalesField,
  type SalesInfoInitialValues,
  type SalesInfoPayload,
} from '@/app/[supabaseId]/components/SalesInfoRequirementDialog';
import {
  leadStatusTransitionClient,
  type LeadStatusTransitionTrigger,
} from '@/lib/services/leadStatusTransitionClient';

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  statusLabels: Record<string, string>;
  onStatusChanged: (leadId: string, patch: Partial<Lead>) => void | Promise<void>;
  closers: UserAssociated[];
  healthPlans: { id: string; name: string }[];
  teamMembers?: UserAssociated[];
  onSchedulePatched?: (payload: ScheduleMeetingSuccessPayload) => void;
}

type PendingConfirmation = {
  status: string;
  confirmationRuleId: string;
  message: string;
};

type PendingSalesInfoGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: MissingSalesField[];
  currentSalesInfo: SalesInfoInitialValues;
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
  healthPlans,
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
  const [pendingSalesInfoGate, setPendingSalesInfoGate] = useState<PendingSalesInfoGate | null>(null);
  const [showSalesInfoDialog, setShowSalesInfoDialog] = useState(false);
  const [salesInfoSaving, setSalesInfoSaving] = useState(false);
  const [meetingHealdGateOpen, setMeetingHealdGateOpen] = useState(false);
  const [meetingHealdBlockedOpen, setMeetingHealdBlockedOpen] = useState(false);
  const [pendingMeetingHealdGate, setPendingMeetingHealdGate] = useState<
    { status: string; trigger?: LeadStatusTransitionTrigger } | null
  >(null);

  const updateLeadStatus = async (
    newStatus: string,
    trigger?: LeadStatusTransitionTrigger,
    allowAutoConfirmation = false
  ) => {
    if (!lead) return false;

    const loadingToast = toast.loading('Atualizando status...');

    try {
      const transitionResult = await leadStatusTransitionClient.executeStatusTransition({
        leadId: lead.id,
        targetStatus: newStatus,
        supabaseId,
        teamId: activeTeamId,
        trigger,
      });

      const { transition, output } = transitionResult;
      if (!transition.allowed) {
        const transitionMessage =
          output.errorMessages?.[0] || 'Não foi possível concluir a mudança de status.';

        if (transition.blockerType === 'meeting_heald') {
          setPendingConfirmation(null);
          if (transition.canConfirmMeetingHeald) {
            setPendingMeetingHealdGate({
              status: newStatus,
              trigger: trigger ? { ...trigger } : undefined,
            });
            setMeetingHealdGateOpen(true);
          } else {
            setMeetingHealdBlockedOpen(true);
          }
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === 'sales_info') {
          const missingFields = Array.isArray(transition.missingFields)
            ? transition.missingFields
            : [];
          const currentSalesInfo: SalesInfoInitialValues = {
            ticket:
              typeof transition.currentSalesInfo?.ticket === 'number'
                ? transition.currentSalesInfo.ticket
                : lead.ticket ?? null,
            contractDueDate:
              typeof transition.currentSalesInfo?.contractDueDate === 'string'
                ? transition.currentSalesInfo.contractDueDate
                : lead.contractDueDate ?? null,
            soldPlan:
              typeof transition.currentSalesInfo?.soldPlan === 'string'
                ? transition.currentSalesInfo.soldPlan
                : lead.soldPlan ?? null,
          };

          setPendingSalesInfoGate({
            status: newStatus,
            trigger: trigger ? { ...trigger } : undefined,
            missingFields,
            currentSalesInfo,
          });
          setShowSalesInfoDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === 'confirmation') {
          const confirmationRuleId =
            typeof transition.confirmationRuleId === 'string'
              ? transition.confirmationRuleId
              : null;
          const confirmationMessage =
            transition.confirmationMessage ||
            transitionMessage ||
            'Confirmação adicional é necessária para concluir esta transição.';

          if (confirmationRuleId && allowAutoConfirmation) {
            return updateLeadStatus(
              newStatus,
              {
                ...(trigger ?? {}),
                confirmRuleId: confirmationRuleId,
              },
              false
            );
          }

          if (confirmationRuleId) {
            setPendingConfirmation({
              status: newStatus,
              confirmationRuleId,
              message: confirmationMessage,
            });
            if (needsTriggerDialog(newStatus)) {
              onOpenChange(false);
              setShowStatusTriggerDialog(true);
            }
            toast.info(confirmationMessage, { id: loadingToast, duration: 5000 });
            return false;
          }
        }

        if (transition.blockerType === 'finalize_contract') {
          onOpenChange(false);
          setShowFinalizeDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === 'schedule_required') {
          onOpenChange(false);
          setShowScheduleDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (
          transition.blockerType === 'future_sale_trigger' ||
          transition.blockerType === 'loss_reason_trigger'
        ) {
          onOpenChange(false);
          setShowStatusTriggerDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        throw new Error(transitionMessage);
      }

      if (!output.isValid) {
        throw new Error(output.errorMessages?.[0] || 'Erro ao atualizar status');
      }

      const payload =
        output.result && typeof output.result === 'object'
          ? (output.result as Partial<Lead>)
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

  const handleSalesInfoSave = async (payload: SalesInfoPayload) => {
    if (!lead || !pendingSalesInfoGate) return;

    setSalesInfoSaving(true);
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseId ? { 'x-supabase-user-id': supabaseId } : {}),
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify(payload),
      });

      const salesResult = await response.json().catch(() => null);
      if (!response.ok || !salesResult?.isValid) {
        throw new Error(salesResult?.errorMessages?.[0] || 'Erro ao salvar informações de venda');
      }

      const salesPatch =
        salesResult.result && typeof salesResult.result === 'object'
          ? (salesResult.result as Partial<Lead>)
          : {};
      await onStatusChanged(lead.id, salesPatch);

      const updated = await updateLeadStatus(
        pendingSalesInfoGate.status,
        pendingSalesInfoGate.trigger,
        false
      );
      if (!updated) return;

      setShowSalesInfoDialog(false);
      setPendingSalesInfoGate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar informações de venda');
    } finally {
      setSalesInfoSaving(false);
    }
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
          leadCloserId={lead.closerId ?? undefined}
          onFinalize={handleFinalizeContract}
          closers={closers}
          healthPlans={healthPlans}
          initialAmount={lead.ticket}
          initialStartDate={lead.contractDueDate}
          initialOperadora={lead.soldPlan}
          initialHolderCnpj={lead.cnpj}
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

      <MeetingHealdConfirmDialog
        open={meetingHealdGateOpen}
        onOpenChange={(open) => {
          setMeetingHealdGateOpen(open);
          if (!open) setPendingMeetingHealdGate(null);
        }}
        onConfirm={async () => {
          if (!pendingMeetingHealdGate) return;
          const mergedTrigger = {
            ...(pendingMeetingHealdGate.trigger ?? {}),
            meetingHeald: 'yes' as const,
          };
          const updated = await updateLeadStatus(pendingMeetingHealdGate.status, mergedTrigger, false);
          if (updated) {
            setMeetingHealdGateOpen(false);
            setPendingMeetingHealdGate(null);
            setShowStatusTriggerDialog(false);
            onOpenChange(false);
          }
        }}
      />

      <MeetingHealdBlockedDialog
        open={meetingHealdBlockedOpen}
        onOpenChange={setMeetingHealdBlockedOpen}
      />

      {lead && pendingSalesInfoGate && (
        <SalesInfoRequirementDialog
          open={showSalesInfoDialog}
          onOpenChange={(open) => {
            setShowSalesInfoDialog(open);
            if (!open) {
              setPendingSalesInfoGate(null);
            }
          }}
          onSave={handleSalesInfoSave}
          healthPlans={healthPlans}
          leadName={lead.name}
          isSaving={salesInfoSaving}
          initialValues={pendingSalesInfoGate.currentSalesInfo}
          missingFields={pendingSalesInfoGate.missingFields}
        />
      )}
    </>
  );
}

