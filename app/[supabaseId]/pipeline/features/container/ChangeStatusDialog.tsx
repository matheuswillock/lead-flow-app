'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toastUserError } from '@/lib/ui/to-user-toast-message';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from '@/components/ui/button';
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
  CloserRequirementDialog,
  type CloserRequirementPayload,
} from '@/app/[supabaseId]/components/CloserRequirementDialog';
import {
  LeadInfoRequirementDialog,
  type LeadInfoInitialValues,
  type LeadInfoPayload,
  type MissingLeadField,
} from '@/app/[supabaseId]/components/LeadInfoRequirementDialog';
import {
  leadStatusTransitionClient,
  type LeadStatusTransitionTrigger,
} from '@/lib/services/leadStatusTransitionClient';
import { mapLeadInfoPayloadForUpdate } from '@/lib/leadStatusTransitionFields';
import { filterSelectableStatusLabelsFromProductGates } from '@/lib/leadStatusTransitionRules';
import {
  fetchProductTransitionGates,
  type ProductLeadStatusTransitionGate,
} from '@/lib/services/leadStatusTransitionGatesClient';
import { API_CLIENT_BASE } from "@/lib/route-map";

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

type PendingCloserGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  currentCloserId: string | null;
};

type PendingLeadInfoGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: MissingLeadField[];
  currentLeadInfo: LeadInfoInitialValues;
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
  const [pendingCloserGate, setPendingCloserGate] = useState<PendingCloserGate | null>(null);
  const [showCloserRequirementDialog, setShowCloserRequirementDialog] = useState(false);
  const [closerRequirementSaving, setCloserRequirementSaving] = useState(false);
  const [pendingLeadInfoGate, setPendingLeadInfoGate] = useState<PendingLeadInfoGate | null>(null);
  const [showLeadInfoDialog, setShowLeadInfoDialog] = useState(false);
  const [leadInfoSaving, setLeadInfoSaving] = useState(false);
  const [transitionGates, setTransitionGates] = useState<ProductLeadStatusTransitionGate[]>([]);

  useEffect(() => {
    if (!open || !supabaseId) return;
    void fetchProductTransitionGates({ supabaseId, teamId: activeTeamId }).then(setTransitionGates);
  }, [open, supabaseId, activeTeamId]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

        if (transition.blockerType === 'closer_required') {
          setPendingCloserGate({
            status: newStatus,
            trigger: trigger ? { ...trigger } : undefined,
            currentCloserId: lead.closerId ?? null,
          });
          setShowCloserRequirementDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === 'lead_info_required') {
          const missingFields = Array.isArray(transition.missingLeadFields)
            ? transition.missingLeadFields
            : [];
          const currentLeadInfo: LeadInfoInitialValues = {
            age:
              typeof transition.currentLeadInfo?.age === 'string'
                ? transition.currentLeadInfo.age
                : lead.age ?? null,
            currentHealthPlan:
              typeof transition.currentLeadInfo?.currentHealthPlan === 'string'
                ? transition.currentLeadInfo.currentHealthPlan
                : lead.currentHealthPlan ?? null,
            referenceHospital:
              typeof transition.currentLeadInfo?.referenceHospital === 'string'
                ? transition.currentLeadInfo.referenceHospital
                : lead.referenceHospital ?? null,
            ongoingTreatment:
              typeof transition.currentLeadInfo?.ongoingTreatment === 'string'
                ? transition.currentLeadInfo.ongoingTreatment
                : lead.currentTreatment ?? null,
            email:
              typeof transition.currentLeadInfo?.email === 'string'
                ? transition.currentLeadInfo.email
                : lead.email ?? null,
            phone:
              typeof transition.currentLeadInfo?.phone === 'string'
                ? transition.currentLeadInfo.phone
                : lead.phone ?? null,
            cnpj:
              typeof transition.currentLeadInfo?.cnpj === 'string'
                ? transition.currentLeadInfo.cnpj
                : lead.cnpj ?? null,
          };

          setPendingLeadInfoGate({
            status: newStatus,
            trigger: trigger ? { ...trigger } : undefined,
            missingFields,
            currentLeadInfo,
          });
          setShowLeadInfoDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === 'email_required') {
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
      toastUserError(error, {
        id: loadingToast,
      });
      console.error('Erro ao atualizar status:', error);
      return false;
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setPendingConfirmation(null);
    setPendingLeadInfoGate(null);
  };

  const handleSubmitStatusChange = async () => {
    if (!selectedStatus || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (selectedStatus === 'scheduled') {
        onOpenChange(false);
        setShowScheduleDialog(true);
        return;
      }

      await updateLeadStatus(selectedStatus);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSuccess = async (payload?: ScheduleMeetingSuccessPayload) => {
    if (payload) {
      onSchedulePatched?.(payload);
    }
    setShowScheduleDialog(false);
  };

  const handleFinalizeContract = async (data: FinalizeContractData) => {
    if (!lead) return;

    const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}/finalize`, {
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
      const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}`, {
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
      toastUserError(error);
    } finally {
      setSalesInfoSaving(false);
    }
  };

  const handleCloserRequirementSave = async (payload: CloserRequirementPayload) => {
    if (!lead || !pendingCloserGate) return;

    setCloserRequirementSaving(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseId ? { 'x-supabase-user-id': supabaseId } : {}),
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify({ closerId: payload.closerId }),
      });

      const closerResult = await response.json().catch(() => null);
      if (!response.ok || !closerResult?.isValid) {
        throw new Error(closerResult?.errorMessages?.[0] || 'Erro ao salvar closer do lead');
      }

      const closerPatch =
        closerResult.result && typeof closerResult.result === 'object'
          ? (closerResult.result as Partial<Lead>)
          : {};
      await onStatusChanged(lead.id, closerPatch);

      const updated = await updateLeadStatus(
        pendingCloserGate.status,
        pendingCloserGate.trigger,
        false
      );
      if (!updated) return;

      setShowCloserRequirementDialog(false);
      setPendingCloserGate(null);
    } catch (error) {
      toastUserError(error);
    } finally {
      setCloserRequirementSaving(false);
    }
  };

  const handleLeadInfoSave = async (payload: LeadInfoPayload) => {
    if (!lead || !pendingLeadInfoGate) return;

    setLeadInfoSaving(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseId ? { 'x-supabase-user-id': supabaseId } : {}),
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
        body: JSON.stringify(mapLeadInfoPayloadForUpdate(payload)),
      });

      const leadInfoResult = await response.json().catch(() => null);
      if (!response.ok || !leadInfoResult?.isValid) {
        throw new Error(leadInfoResult?.errorMessages?.[0] || 'Erro ao salvar informações do lead');
      }

      const leadInfoPatch =
        leadInfoResult.result && typeof leadInfoResult.result === 'object'
          ? (leadInfoResult.result as Partial<Lead>)
          : {};
      await onStatusChanged(lead.id, leadInfoPatch);

      const updated = await updateLeadStatus(
        pendingLeadInfoGate.status,
        pendingLeadInfoGate.trigger,
        false
      );
      if (!updated) return;

      setShowLeadInfoDialog(false);
      setPendingLeadInfoGate(null);
    } catch (error) {
      toastUserError(error);
    } finally {
      setLeadInfoSaving(false);
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
                  {(lead
                    ? filterSelectableStatusLabelsFromProductGates(
                        lead.status ?? '',
                        statusLabels,
                        transitionGates
                      )
                    : Object.entries(statusLabels)
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void handleSubmitStatusChange()}
              disabled={!selectedStatus || isSubmitting}
            >
              {isSubmitting ? 'Mudando status...' : 'Mudar status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        lead={lead}
        onScheduleSuccess={handleScheduleSuccess}
        closers={closers}
        teamMembers={teamMembers}
        mode="create"
      />

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
        initialHolderRazaoSocial={lead.razaoSocial}
      />

      {selectedStatus && needsTriggerDialog(selectedStatus) && (
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
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingConfirmation(null);
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
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmCombinedRule();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MeetingHealdConfirmDialog
        open={meetingHealdGateOpen}
        onOpenChange={(nextOpen) => {
          setMeetingHealdGateOpen(nextOpen);
          if (!nextOpen) setPendingMeetingHealdGate(null);
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

      {pendingSalesInfoGate && (
        <SalesInfoRequirementDialog
          open={showSalesInfoDialog}
          onOpenChange={(nextOpen) => {
            setShowSalesInfoDialog(nextOpen);
            if (!nextOpen) setPendingSalesInfoGate(null);
          }}
          onSave={handleSalesInfoSave}
          healthPlans={healthPlans}
          leadName={lead.name}
          isSaving={salesInfoSaving}
          initialValues={pendingSalesInfoGate.currentSalesInfo}
          missingFields={pendingSalesInfoGate.missingFields}
        />
      )}

      {pendingCloserGate && (
        <CloserRequirementDialog
          open={showCloserRequirementDialog}
          onOpenChange={(nextOpen) => {
            setShowCloserRequirementDialog(nextOpen);
            if (!nextOpen) setPendingCloserGate(null);
          }}
          onSave={handleCloserRequirementSave}
          closers={closers}
          leadName={lead.name}
          isSaving={closerRequirementSaving}
          initialCloserId={pendingCloserGate.currentCloserId}
        />
      )}

      {pendingLeadInfoGate && (
        <LeadInfoRequirementDialog
          open={showLeadInfoDialog}
          onOpenChange={(nextOpen) => {
            setShowLeadInfoDialog(nextOpen);
            if (!nextOpen) setPendingLeadInfoGate(null);
          }}
          onSave={handleLeadInfoSave}
          leadName={lead.name}
          isSaving={leadInfoSaving}
          initialValues={pendingLeadInfoGate.currentLeadInfo}
          missingFields={pendingLeadInfoGate.missingFields}
        />
      )}
    </>
  );
}
