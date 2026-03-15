'use client';

import { ReactNode } from "react";
import PipelineTable from "./PipelineTable";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { Table2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import usePipelineContext from "../context/PipelineHook";
import LeadImportButton from "@/app/[supabaseId]/components/LeadImportButton";

interface PipelineContainerProps {
  title?: string;
  viewModeToggle?: ReactNode;
  filtersBar?: ReactNode;
  useExternalFilters?: boolean;
}

export function PipelineContainer({
  title = "Pipeline de Leads",
  viewModeToggle,
  filtersBar,
  useExternalFilters = false,
}: PipelineContainerProps = {}) {
  const { user, userLoading, allLeads, isLoading, openNewLeadDialog, open, setOpen, selected: lead, refreshLeads, finalizeContract, patchLead } = usePipelineContext();
  
  // Calcular total de leads
  const totalLeads = allLeads.length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Table2 className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {userLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : user ? (
              <p className="text-sm text-muted-foreground">
                {user.email} ({user.role}) • {isLoading ? "Carregando..." : `${totalLeads} leads`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewModeToggle}
          <Button onClick={openNewLeadDialog} size="default" className="cursor-pointer">
            <Plus className="mr-2 size-4" />
            Adicionar novo lead
          </Button>
          <LeadImportButton onImportComplete={refreshLeads} />
        </div>
      </div>

      {filtersBar}

      {/* Table */}
      <PipelineTable useExternalFilters={useExternalFilters} />

      {/* Dialog */}
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
    </div>
  )
}
