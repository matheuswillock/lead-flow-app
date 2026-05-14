'use client';

import { ReactNode } from "react";
import PipelineTable from "./PipelineTable";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import { Table2, Plus, Settings, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import usePipelineContext from "../context/PipelineHook";
import {
  DEFAULT_PIPELINE_TABLE_COLUMN_ORDER,
  DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY,
} from "../context/PipelineContext";
import LeadImportButton from "@/app/[supabaseId]/components/LeadImportButton";
import { useTeamContext } from "@/app/context/TeamContext";

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

type PipelineColumnOptionKey = (typeof PIPELINE_TABLE_COLUMN_OPTIONS)[number]["key"];

function SortablePipelineColumnOption({
  option,
  isChecked,
  onCheckedChange,
}: {
  option: (typeof PIPELINE_TABLE_COLUMN_OPTIONS)[number];
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const checkboxId = `pipeline-column-${option.key}`;
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: option.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
    >
      <div className="flex items-center gap-3">
        <Checkbox
          id={checkboxId}
          checked={isChecked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <Label htmlFor={checkboxId} className="text-sm font-medium leading-none">
          {option.label}
        </Label>
      </div>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
        aria-label={`Reordenar coluna ${option.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
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
    filtered,
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
    tableColumnOrder,
    setTableColumnOrder,
  } = usePipelineContext();

  const { activeFunctions, activeRole, isTeamMaster } = useTeamContext();
  const canAddLead =
    !activeFunctions.includes("CLOSER") ||
    isTeamMaster ||
    activeRole === "manager" ||
    activeRole === "backoffice";

  const sensors = useSensors(useSensor(PointerSensor));

  const orderedColumnOptions = (() => {
    const optionMap = new Map(
      PIPELINE_TABLE_COLUMN_OPTIONS.map((option) => [option.key, option] as const)
    );
    const sorted: (typeof PIPELINE_TABLE_COLUMN_OPTIONS)[number][] = [];
    tableColumnOrder.forEach((columnId) => {
      const option = optionMap.get(columnId as PipelineColumnOptionKey);
      if (option) {
        sorted.push(option);
        optionMap.delete(columnId as PipelineColumnOptionKey);
      }
    });
    optionMap.forEach((option) => sorted.push(option));
    return sorted;
  })();

  const handleColumnConfigDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = orderedColumnOptions.map((option) => option.key);
    const oldIndex = currentOrder.indexOf(active.id as PipelineColumnOptionKey);
    const newIndex = currentOrder.indexOf(over.id as PipelineColumnOptionKey);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex);
    setTableColumnOrder((prev) => {
      const hasDrag = prev.includes("drag");
      const hasActions = prev.includes("actions");
      return [
        ...(hasDrag ? ["drag"] : []),
        ...nextOrder,
        ...(hasActions ? ["actions"] : []),
      ];
    });
  };
  
  // Calcular total de leads
  const totalLeads = filtered.length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Table2 className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {userLoading || isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <p className="text-sm text-muted-foreground">{totalLeads} leads</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewModeToggle}
          {canAddLead && (
            <Button onClick={openNewLeadDialog} size="default" className="cursor-pointer">
              <Plus className="mr-2 size-4" />
              Adicionar novo lead
            </Button>
          )}
          <Sheet>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Configuração das colunas da tabela"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Configuração das colunas</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <SheetContent side="right" className="w-[420px] sm:w-[460px]">
              <SheetHeader>
                <SheetTitle>Configuração das colunas</SheetTitle>
                <SheetDescription>
                  Selecione quais headers devem aparecer na tabela do pipeline.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid gap-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnConfigDragEnd}
                >
                  <SortableContext
                    items={orderedColumnOptions.map((option) => option.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="grid gap-3">
                      {orderedColumnOptions.map((option) => (
                        <SortablePipelineColumnOption
                          key={option.key}
                          option={option}
                          isChecked={tableColumnVisibility[option.key] !== false}
                          onCheckedChange={(nextChecked) => {
                            setTableColumnVisibility((prev) => ({
                              ...prev,
                              [option.key]: nextChecked,
                            }));
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
              <p className="text-xs text-muted-foreground">
                Isso afeta apenas a tabela do pipeline. Você pode arrastar os itens acima para definir a ordem.
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTableColumnVisibility(DEFAULT_PIPELINE_TABLE_COLUMN_VISIBILITY);
                    setTableColumnOrder(DEFAULT_PIPELINE_TABLE_COLUMN_ORDER);
                  }}
                >
                  Restaurar padrão
                </Button>
              </div>
            </SheetContent>
          </Sheet>
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
