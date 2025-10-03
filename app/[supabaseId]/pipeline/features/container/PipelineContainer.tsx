'use client';

import PipelineTable from "./PipelineTable";
import PipelineDialog from "./PipelineDialog";
import { Table2, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import usePipelineContext from "../context/PipelineHook";

export function PipelineContainer() {
  const { user, userLoading, allLeads, isLoading, openNewLeadDialog } = usePipelineContext();
  
  // Calcular total de leads
  const totalLeads = allLeads.length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Table2 className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">Pipeline de Leads</h1>
            {userLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : user ? (
              <p className="text-sm text-muted-foreground">
                {user.email} ({user.role}) • {isLoading ? 'Carregando...' : `${totalLeads} leads`}
              </p>
            ) : null}
          </div>
        </div>
        <Button 
          onClick={openNewLeadDialog}
          size="default"
        >
          <Plus className="mr-2 size-4" />
          Adicionar novo lead
        </Button>
      </div>

      {/* Table */}
      <PipelineTable />
      
      {/* Dialog */}
      <PipelineDialog />
    </div>
  );
}
