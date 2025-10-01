"use client"

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import BoardDialog from "./BoardDialog";
import { FinalizeContractDialog } from "./FinalizeContractDialog";
import useBoardContext from "../context/BoardHook";
import { Lead } from "../context/BoardTypes";
import { toast } from "sonner";

export function BoardContainer() {
  const { openNewLeadDialog, finalizeContract } = useBoardContext();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const handleFinalizeContract = (lead: Lead) => {
    setSelectedLead(lead);
    setShowFinalizeDialog(true);
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

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full flex-col gap-3 p-4">

      <BoardHeader />

      <BoardColumns onFinalizeContract={handleFinalizeContract} />

      <BoardFooter />

      <Button 
        size="lg" 
        className="w-96 h-14 self-center justify-center text-2xl rounded-4xl mt-12 cursor-pointer"
        onClick={openNewLeadDialog}
      >
        <Plus className="mr-1 size-4" /> Adicionar novo lead
      </Button>

      <BoardDialog />

      {selectedLead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={setShowFinalizeDialog}
          leadName={selectedLead.name}
          onFinalize={handleFinalizeSubmit}
        />
      )}
    </div>
  );
}