'use client';

import { ReactNode } from "react";
import PipelineTable from "./PipelineTable";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { Table2, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import usePipelineContext from "../context/PipelineHook";
import { DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY } from "../context/PipelineContext";
import LeadImportButton from "@/app/[supabaseId]/components/LeadImportButton";

const PIPELINE_TABLE_COLUMN_OPTIONS = [
  { key: "name", label: "Nome" },
  { key: "leadCode", label: "ID" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "currentHealthPlan", label: "Plano atual" },
  { key: "currentValue", label: "Valor atual" },
  { key: "status", label: "Status" },
  { key: "ticket", label: "Ticket" },
  { key: "assignedTo", label: "Responsável" },
  { key: "closerId", label: "Closer" },
  { key: "meetingDate", label: "Reunião" },
  { key: "createdAt", label: "Criado em" },
] as const;

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
  const {
    user,
    userLoading,
    allLeads,
    isLoading,
    openNewLeadDialog,
    open,
    setOpen,
    selected: lead,
    refreshLeads,
    finalizeContract,
    patchLead,
    tableColumnVisibility,
    setTableColumnVisibility,
  } = usePipelineContext();
  
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
          <Dialog>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Configuração das colunas da tabela"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Configuração das colunas</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Configuração das colunas</DialogTitle>
                <DialogDescription>
                  Selecione quais headers devem aparecer na tabela do pipeline.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                {PIPELINE_TABLE_COLUMN_OPTIONS.map((option) => {
                  const checkboxId = `pipeline-column-${option.key}`;
                  const isChecked = tableColumnVisibility[option.key] !== false;

                  return (
                    <div
                      key={option.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={checkboxId}
                          checked={isChecked}
                          onCheckedChange={(value) => {
                            const nextChecked = value === true;
                            setTableColumnVisibility((prev) => ({
                              ...prev,
                              [option.key]: nextChecked,
                            }));
                          }}
                        />
                        <Label htmlFor={checkboxId} className="text-sm font-medium leading-none">
                          {option.label}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Isso afeta apenas a tabela do pipeline.
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTableColumnVisibility(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY)}
                >
                  Restaurar padrão
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
