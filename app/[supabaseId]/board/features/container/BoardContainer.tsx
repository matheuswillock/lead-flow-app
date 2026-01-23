"use client"

import React, { useState } from "react";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { FinalizeContractDialog } from "./FinalizeContractDialog";
import { ScheduleMeetingDialog } from "./ScheduleMeetingDialog";
import useBoardContext from "../context/BoardHook";
import { Lead } from "../context/BoardTypes";
import { toast } from "sonner";

export function BoardContainer() {
  const { finalizeContract, refreshLeads, open, setOpen, selected: lead, user, userLoading } = useBoardContext();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const handleFinalizeContract = (lead: Lead) => {
    setSelectedLead(lead);
    setShowFinalizeDialog(true);
  };

  const handleScheduleMeeting = (lead: Lead) => {
    setSelectedLead(lead);
    setShowScheduleDialog(true);
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
          />
        </>
      )}
    </div>
  );
}