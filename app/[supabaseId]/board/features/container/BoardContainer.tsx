"use client"

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { FinalizeContractDialog, type FinalizeContractData } from "./FinalizeContractDialog";
import { ScheduleMeetingDialog, type ScheduleMeetingSuccessPayload } from "./ScheduleMeetingDialog";
import { LeadStatusTriggerDialog, type LeadStatusTriggerPayload } from "./LeadStatusTriggerDialog";
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
import useBoardContext from "../context/BoardHook";
import { Lead } from "../context/BoardTypes";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTeamClosers } from "@/hooks/useTeamMembersByFunction";

interface BoardContainerProps {
  title?: string;
  viewModeToggle?: ReactNode;
  filtersBar?: ReactNode;
}

export function BoardContainer({
  title,
  viewModeToggle,
  filtersBar,
}: BoardContainerProps = {}) {
  const {
    finalizeContract,
    refreshLeads,
    open,
    setOpen,
    selected: lead,
    user,
    userLoading,
    patchLead,
    pendingScheduledDrop,
    clearPendingScheduledDrop,
    applyScheduledTransition,
    pendingStatusTriggerDrop,
    clearPendingStatusTriggerDrop,
    applyPendingStatusTriggerTransition,
    data,
  } = useBoardContext();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showStatusTriggerDialog, setShowStatusTriggerDialog] = useState(false);
  const [scheduleDialogMode, setScheduleDialogMode] = useState<"create" | "reschedule">("create");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const scheduleSucceededRef = useRef(false);
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);
  const pendingDropLead = useMemo(() => {
    if (!pendingScheduledDrop) return null;
    return data[pendingScheduledDrop.from]?.find((item) => item.id === pendingScheduledDrop.leadId) ?? null;
  }, [data, pendingScheduledDrop]);
  const pendingStatusTriggerLead = useMemo(() => {
    if (!pendingStatusTriggerDrop) return null;
    return (
      data[pendingStatusTriggerDrop.from]?.find((item) => item.id === pendingStatusTriggerDrop.leadId) ??
      null
    );
  }, [data, pendingStatusTriggerDrop]);
  const pendingNeedsTriggerDialog = useMemo(
    () =>
      pendingStatusTriggerDrop?.to === "future_sale" ||
      pendingStatusTriggerDrop?.to === "opportunityLost" ||
      pendingStatusTriggerDrop?.to === "operator_denied",
    [pendingStatusTriggerDrop]
  );

  const handleFinalizeContract = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setShowFinalizeDialog(true);
  }, []);

  const handleScheduleMeeting = useCallback((lead: Lead) => {
    scheduleSucceededRef.current = false;
    setSelectedLead(lead);
    setScheduleDialogMode(lead.status === "no_show" ? "reschedule" : "create");
    setShowScheduleDialog(true);
  }, []);

  useEffect(() => {
    if (!pendingScheduledDrop || !pendingDropLead) return;
    scheduleSucceededRef.current = false;
    setSelectedLead(pendingDropLead);
    setScheduleDialogMode(pendingScheduledDrop.from === "no_show" ? "reschedule" : "create");
    setShowScheduleDialog(true);
  }, [pendingDropLead, pendingScheduledDrop]);

  useEffect(() => {
    if (!pendingStatusTriggerDrop) return;
    setSelectedLead(pendingStatusTriggerLead ?? null);
    if (pendingNeedsTriggerDialog) {
      setShowStatusTriggerDialog(true);
    }
  }, [pendingNeedsTriggerDialog, pendingStatusTriggerDrop, pendingStatusTriggerLead]);

  const handleNoShow = useCallback(
    async (lead: Lead) => {
      if (!supabaseId) {
        toast.error("Usuario nao identificado");
        return;
      }

      try {
        const response = await fetch(`/api/v1/leads/${lead.id}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify({ status: "no_show" }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Erro ao marcar no-show");
        }

        const payload =
          result.result && typeof result.result === "object"
            ? (result.result as Partial<Lead>)
            : {};
        patchLead(lead.id, { ...payload, status: "no_show" });
        toast.success("Lead marcado como no-show");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao marcar no-show");
      }
    },
    [activeTeamId, patchLead, supabaseId]
  );

  const handleFinalizeSubmit = async (data: FinalizeContractData) => {
    if (!selectedLead) return;

    try {
      await finalizeContract(selectedLead.id, data);
      toast.success('Contrato finalizado com sucesso!');
      setShowFinalizeDialog(false);
      setSelectedLead(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao finalizar contrato');
      throw error; // Re-throw para o dialog poder mostrar o erro
    }
  };

  const handleScheduleSuccess = async (payload?: ScheduleMeetingSuccessPayload) => {
    scheduleSucceededRef.current = true;

    if (payload && selectedLead) {
      applyScheduledTransition(selectedLead.status, {
        id: payload.leadId,
        status: payload.status,
        meetingDate: payload.meetingDate,
        meetingTitle: payload.meetingTitle,
        meetingNotes: payload.meetingNotes,
        meetingLink: payload.meetingLink,
        closerId: payload.closerId,
      });
    }
    setSelectedLead(null);
  };

  const handleStatusTriggerSuccess = async (payload: LeadStatusTriggerPayload) => {
    if (!pendingStatusTriggerDrop) return;

    if (payload.kind === "future_sale") {
      const updated = await applyPendingStatusTriggerTransition({
        followUpAt: payload.followUpAt,
        followUpNotes: payload.followUpNotes,
        confirmRuleId: payload.confirmRuleId,
      });
      if (!updated) return;
    } else {
      const updated = await applyPendingStatusTriggerTransition({
        reason: payload.reason,
        reasonDetails: payload.reasonDetails,
        confirmRuleId: payload.confirmRuleId,
      });
      if (!updated) return;
    }

    setShowStatusTriggerDialog(false);
    setSelectedLead(null);
  };

  const handleConfirmPendingRule = async () => {
    if (!pendingStatusTriggerDrop?.confirmationRuleId) return;
    const updated = await applyPendingStatusTriggerTransition({
      confirmRuleId: pendingStatusTriggerDrop.confirmationRuleId,
    });
    if (!updated) return;
    setSelectedLead(null);
  };

  const statusTriggerLabel =
    pendingStatusTriggerDrop?.to === "future_sale"
      ? "Venda Futura"
      : pendingStatusTriggerDrop?.to === "opportunityLost"
      ? "Perdido"
      : pendingStatusTriggerDrop?.to === "operator_denied"
      ? "Negado operadora"
      : "Status";

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 p-4">

      <BoardHeader
        title={title}
        viewModeToggle={viewModeToggle}
        hideFiltersBar={!!filtersBar}
      />
      {filtersBar}

      <BoardColumns 
        onFinalizeContract={handleFinalizeContract}
        onScheduleMeeting={handleScheduleMeeting}
        onNoShow={handleNoShow}
      />

      <BoardFooter />

      <LeadDialog
        open={open}
        setOpen={setOpen}
        lead={lead}
        user={user}
        userLoading={userLoading}
        refreshLeads={refreshLeads}
        finalizeContract={finalizeContract}
        patchLead={patchLead}
      />

      {selectedLead && (
        <>
          <FinalizeContractDialog
            open={showFinalizeDialog}
            onOpenChange={setShowFinalizeDialog}
            leadName={selectedLead.name}
            onFinalize={handleFinalizeSubmit}
          />
          
          <ScheduleMeetingDialog
            open={showScheduleDialog}
            onOpenChange={(open) => {
              setShowScheduleDialog(open);
              if (!open) {
                if (!scheduleSucceededRef.current) {
                  clearPendingScheduledDrop();
                }
                setScheduleDialogMode("create");
                setSelectedLead(null);
              }
            }}
            lead={selectedLead}
            onScheduleSuccess={handleScheduleSuccess}
            closers={closers}
            teamMembers={[]}
            mode={scheduleDialogMode}
          />
        </>
      )}

      {pendingStatusTriggerDrop && pendingNeedsTriggerDialog && (
        <LeadStatusTriggerDialog
          open={showStatusTriggerDialog}
          onOpenChange={(open) => {
            setShowStatusTriggerDialog(open);
            if (!open) {
              clearPendingStatusTriggerDrop();
              setSelectedLead(null);
            }
          }}
          mode={pendingStatusTriggerDrop.to === "future_sale" ? "future_sale" : "loss_reason"}
          leadName={selectedLead?.name || "Lead selecionado"}
          statusLabel={statusTriggerLabel}
          confirmationMessage={pendingStatusTriggerDrop.confirmationMessage || null}
          confirmationRuleId={pendingStatusTriggerDrop.confirmationRuleId || null}
          onConfirm={handleStatusTriggerSuccess}
        />
      )}

      <AlertDialog
        open={!!pendingStatusTriggerDrop && !pendingNeedsTriggerDialog}
        onOpenChange={(open) => {
          if (!open) {
            clearPendingStatusTriggerDrop();
            setSelectedLead(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação necessária</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusTriggerDrop?.confirmationMessage ||
                "Deseja confirmar esta transição de status?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPendingRule();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
