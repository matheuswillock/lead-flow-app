"use client"

import React, { useMemo, useState } from "react";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { FinalizeContractDialog } from "./FinalizeContractDialog";
import { ScheduleMeetingDialog } from "./ScheduleMeetingDialog";
import useBoardContext from "../context/BoardHook";
import { Lead } from "../context/BoardTypes";
import { toast } from "sonner";
import { useParams } from "next/navigation";

export function BoardContainer() {
  const { finalizeContract, refreshLeads, open, setOpen, selected: lead, user, userLoading } = useBoardContext();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;

  const closers = useMemo(() => {
    const users = user?.usersAssociated || [];
    return users.filter((u) => u.functions?.includes("CLOSER"));
  }, [user]);

  const handleFinalizeContract = (lead: Lead) => {
    setSelectedLead(lead);
    setShowFinalizeDialog(true);
  };

  const handleScheduleMeeting = (lead: Lead) => {
    setSelectedLead(lead);
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

  const handleScheduleSuccess = async () => {
    await refreshLeads();
    setSelectedLead(null);
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full flex-col gap-3 p-4">

      <BoardHeader />

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
            onOpenChange={setShowScheduleDialog}
            lead={selectedLead}
            onScheduleSuccess={handleScheduleSuccess}
            closers={closers}
          />
        </>
      )}
    </div>
  );
}
