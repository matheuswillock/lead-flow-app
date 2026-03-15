"use client"

import React, { ReactNode, useState } from "react";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { FinalizeContractDialog } from "./FinalizeContractDialog";
import { ScheduleMeetingDialog, type ScheduleMeetingSuccessPayload } from "./ScheduleMeetingDialog";
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
  const { finalizeContract, refreshLeads, open, setOpen, selected: lead, user, userLoading, patchLead } = useBoardContext();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDialogMode, setScheduleDialogMode] = useState<"create" | "reschedule">("create");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);

  const handleFinalizeContract = (lead: Lead) => {
    setSelectedLead(lead);
    setShowFinalizeDialog(true);
  };

  const handleScheduleMeeting = (lead: Lead) => {
    setSelectedLead(lead);
    setScheduleDialogMode(lead.status === "no_show" ? "reschedule" : "create");
    setShowScheduleDialog(true);
  };

  const handleNoShow = async (lead: Lead) => {
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

      if (!response.ok) {
        throw new Error("Erro ao marcar no-show");
      }

      toast.success("Lead marcado como no-show");
      await refreshLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar no-show");
    }
  };

  const handleFinalizeSubmit = async (data: any) => {
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
    if (payload) {
      patchLead?.(payload.leadId, {
        status: payload.status,
        meetingDate: payload.meetingDate,
        meetingTitle: payload.meetingTitle,
        meetingNotes: payload.meetingNotes,
        meetingLink: payload.meetingLink,
        closerId: payload.closerId,
      });
    }
    await refreshLeads();
    setSelectedLead(null);
  };

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
                setScheduleDialogMode("create");
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
    </div>
  );
}
