'use client';

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import usePipelineContext from "../context/PipelineHook";
import { Lead } from "../context/PipelineTypes";
import { DraggableRow } from "./DraggableRow";
import { toast } from "sonner";
import { useState } from "react";
import {
  ScheduleMeetingDialog,
  type ScheduleMeetingSuccessPayload,
} from "@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { createColumns } from "./PipelineColumns";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { DateRange } from "react-day-picker";
import { X } from "lucide-react";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
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

interface PipelineTableProps {
  useExternalFilters?: boolean;
}

export default function PipelineTable({ useExternalFilters = false }: PipelineTableProps) {
  const draggedColumnIdRef = React.useRef<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = React.useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = React.useState<string | null>(null);
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { 
    filtered, 
    handleRowClick, 
    statusLabels, 
    isLoading,
    setSelected,
    refreshLeads,
    patchLead,
    errors,
    onlyMeetingsHeld,
    setOnlyMeetingsHeld,
    tableColumnVisibility,
    setTableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
  } = usePipelineContext();
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [data, setData] = React.useState<Lead[]>(filtered);
  
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDialogMode, setScheduleDialogMode] = useState<"create" | "reschedule">("create");
  const [showChangeStatusDialog, setShowChangeStatusDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Atualizar data quando filtered mudar
  React.useEffect(() => {
    setData(filtered);
  }, [filtered]);

  // Configurar sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Handler para quando o drag terminar
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setData((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Preparar opções de status para o filtro
  const statusOptions = React.useMemo(() => {
    return Object.entries(statusLabels).map(([value, label]) => ({
      label,
      value,
    }));
  }, [statusLabels]);

  // Preparar opções de responsáveis para o filtro
  const responsibleOptions = React.useMemo(() => {
    return sdrMembers.map((sdr) => ({
      label: sdr.name || sdr.email,
      value: sdr.id,
    }));
  }, [sdrMembers]);

  const closers = React.useMemo(() => {
    return closerMembers;
  }, [closerMembers]);

  const closerOptions = React.useMemo(() => {
    return closers.map((closer) => ({
      label: (closer as { fullName?: string; name?: string; email?: string }).fullName
        || (closer as { name?: string }).name
        || closer.email,
      value: closer.id,
    }));
  }, [closers]);

  const handleScheduleMeeting = (lead: Lead) => {
    setSelectedLead(lead);
    setScheduleDialogMode("create");
    setShowScheduleDialog(true);
  };

  const handleRescheduleMeeting = (lead: Lead) => {
    setSelectedLead(lead);
    setScheduleDialogMode("reschedule");
    setShowScheduleDialog(true);
  };

  const handleDeleteLead = async (lead: Lead) => {
    setLeadToDelete(lead);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (isDeletingLead) return;
    setDeleteDialogOpen(open);
    if (!open) {
      setLeadToDelete(null);
    }
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete || isDeletingLead) return;
    setIsDeletingLead(true);
    try {
      const response = await fetch(`/api/v1/leads/${leadToDelete.id}`, {
        method: 'DELETE',
        headers: {
          ...(supabaseId ? { 'x-supabase-user-id': supabaseId } : {}),
          ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar lead');
      }

      toast.success('Lead deletado com sucesso!');
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
      await refreshLeads();
    } catch (error) {
      toast.error('Erro ao deletar lead');
      console.error('Erro ao deletar lead:', error);
    } finally {
      setIsDeletingLead(false);
    }
  };

  const handleFinalizeContract = async (lead: Lead) => {
    setSelected(lead);
    // Aqui você pode adicionar a lógica para finalizar o contrato
    // Por exemplo, abrir um modal ou chamar uma API
    toast.success('Funcionalidade de finalizar contrato será implementada');
  };

  const handleChangeStatus = (lead: Lead) => {
    setSelectedLead(lead);
    setShowChangeStatusDialog(true);
  };

  const applyScheduledPatch = React.useCallback(
    (payload: ScheduleMeetingSuccessPayload) => {
      patchLead(payload.leadId, {
        status: payload.status,
        meetingDate: payload.meetingDate,
        meetingTitle: payload.meetingTitle,
        meetingNotes: payload.meetingNotes,
        meetingLink: payload.meetingLink,
        closerId: payload.closerId,
      });
      setSelectedLead((prev) =>
        prev?.id === payload.leadId
          ? {
              ...prev,
              status: payload.status,
              meetingDate: payload.meetingDate,
              meetingTitle: payload.meetingTitle,
              meetingNotes: payload.meetingNotes,
              meetingLink: payload.meetingLink,
              closerId: payload.closerId,
            }
          : prev
      );
    },
    [patchLead]
  );

  const handleScheduleSuccess = React.useCallback(
    async (payload?: ScheduleMeetingSuccessPayload) => {
      if (payload) {
        applyScheduledPatch(payload);
      }
      await refreshLeads();
    },
    [applyScheduledPatch, refreshLeads]
  );

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () =>
      createColumns({
        statusLabels,
        onRowClick: handleRowClick,
        onScheduleMeeting: handleScheduleMeeting,
        onRescheduleMeeting: handleRescheduleMeeting,
        onDeleteLead: handleDeleteLead,
        onFinalizeContract: handleFinalizeContract,
        onChangeStatus: handleChangeStatus,
      }),
    [statusLabels]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility: tableColumnVisibility,
      columnOrder: tableColumnOrder,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setTableColumnVisibility,
    onColumnOrderChange: setTableColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.id,
  });

  const handleHeaderDragStart = React.useCallback((event: React.DragEvent<HTMLElement>, columnId: string) => {
    draggedColumnIdRef.current = columnId;
    setDraggingColumnId(columnId);
    setDragOverColumnId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", columnId);
  }, []);

  const handleHeaderDrop = React.useCallback(
    (targetColumnId: string) => {
      const sourceColumnId = draggedColumnIdRef.current;
      draggedColumnIdRef.current = null;
      setDragOverColumnId(null);
      setDraggingColumnId(null);

      if (!sourceColumnId || sourceColumnId === targetColumnId) return;
      if (sourceColumnId === "drag" || sourceColumnId === "actions") return;
      if (targetColumnId === "drag" || targetColumnId === "actions") return;

      setTableColumnOrder((prev) => {
        const currentOrder = prev.length ? [...prev] : [...table.getAllLeafColumns().map((column) => column.id)];
        const sourceIndex = currentOrder.indexOf(sourceColumnId);
        const targetIndex = currentOrder.indexOf(targetColumnId);

        if (sourceIndex === -1 || targetIndex === -1) return currentOrder;

        currentOrder.splice(sourceIndex, 1);
        currentOrder.splice(targetIndex, 0, sourceColumnId);
        return currentOrder;
      });
    },
    [setTableColumnOrder, table]
  );

  const statusColumn = table.getColumn("status");
  const assignedToColumn = table.getColumn("assignedTo");
  const closerColumn = table.getColumn("closerId");
  const createdAtColumn = table.getColumn("createdAt");

  const selectedStatuses = (statusColumn?.getFilterValue() as string[]) ?? [];
  const selectedResponsibles =
    (assignedToColumn?.getFilterValue() as string[]) ?? [];
  const selectedClosers = (closerColumn?.getFilterValue() as string[]) ?? [];

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (!createdAtColumn) return;
    if (!range || (!range.from && !range.to)) {
      createdAtColumn.setFilterValue(undefined);
      return;
    }
    if (range.from && range.to) {
      createdAtColumn.setFilterValue([range.from, range.to]);
    } else if (range.from) {
      createdAtColumn.setFilterValue([range.from, undefined]);
    }
  };

  const isFiltered = table.getState().columnFilters.length > 0 || onlyMeetingsHeld;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-[220px]" />
            <Skeleton className="h-8 w-[140px]" />
            <Skeleton className="h-8 w-[140px]" />
            <Skeleton className="h-8 w-[140px]" />
            <Skeleton className="h-8 w-[160px]" />
          </div>
          <Skeleton className="h-8 w-[110px]" />
        </div>

        <div className="rounded-md border">
          <div className="border-b p-2">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: 10 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end px-2">
          <div className="flex items-center space-x-6 lg:space-x-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center space-x-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-8 w-8" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errors?.api) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-destructive mb-2">Erro ao carregar leads</p>
          <p className="text-muted-foreground text-sm">{errors.api}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!useExternalFilters && (
        <LeadsFiltersLayout>
          <Input
            placeholder="Filtrar por nome..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {statusColumn && (
            <LeadsStatusFilter
              statusOptions={statusOptions}
              selectedStatuses={selectedStatuses}
              onChangeStatuses={(values) =>
                statusColumn.setFilterValue(values.length ? values : undefined)
              }
              meetingHeld={onlyMeetingsHeld}
              onToggleMeetingHeld={setOnlyMeetingsHeld}
            />
          )}
          {assignedToColumn && responsibleOptions.length > 0 && (
            <LeadsMultiFilter
              title="Responsável"
              options={responsibleOptions}
              selectedValues={selectedResponsibles}
              onChange={(values) =>
                assignedToColumn.setFilterValue(values.length ? values : undefined)
              }
            />
          )}
          {closerColumn && closerOptions.length > 0 && (
            <LeadsMultiFilter
              title="Closer"
              options={closerOptions}
              selectedValues={selectedClosers}
              onChange={(values) =>
                closerColumn.setFilterValue(values.length ? values : undefined)
              }
            />
          )}
          {createdAtColumn && (
            <LeadsDateFilter
              title="Data de Criação"
              value={dateRange}
              onChange={handleDateChange}
            />
          )}
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => {
                table.resetColumnFilters();
                setOnlyMeetingsHeld(false);
                setDateRange(undefined);
              }}
              className="h-8 px-2 lg:px-3"
            >
              Limpar
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </LeadsFiltersLayout>
      )}
      <div className="rounded-md border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canReorder = !header.isPlaceholder && header.column.id !== "drag" && header.column.id !== "actions";

                    return (
                      <TableHead
                        key={header.id}
                        className={`text-center align-middle ${canReorder ? "cursor-move select-none" : ""} ${draggingColumnId === header.column.id ? "opacity-60" : ""} ${dragOverColumnId === header.column.id ? "bg-muted/50 ring-1 ring-primary/40" : ""}`}
                        draggable={canReorder}
                        onDragStart={
                          canReorder
                            ? (event) => handleHeaderDragStart(event, header.column.id)
                            : undefined
                        }
                        onDragOver={
                          canReorder
                            ? (event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                                if (draggedColumnIdRef.current && draggedColumnIdRef.current !== header.column.id) {
                                  setDragOverColumnId(header.column.id);
                                }
                              }
                            : undefined
                        }
                        onDragLeave={
                          canReorder
                            ? () => {
                                setDragOverColumnId((prev) =>
                                  prev === header.column.id ? null : prev
                                );
                              }
                            : undefined
                        }
                        onDragEnd={
                          canReorder
                            ? () => {
                                draggedColumnIdRef.current = null;
                                setDragOverColumnId(null);
                                setDraggingColumnId(null);
                              }
                            : undefined
                        }
                        onDrop={
                          canReorder
                            ? (event) => {
                                event.preventDefault();
                                handleHeaderDrop(header.column.id);
                              }
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <SortableContext items={data.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} onRowClick={handleRowClick} />
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </SortableContext>
          </Table>
        </DndContext>
      </div>
      <div className="flex items-center justify-end px-2">
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Linhas por página</p>
            <select
              aria-label="Linhas por página"
              title="Linhas por página"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="h-8 w-[70px] rounded-md border border-input bg-background"
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir para primeira página</span>
              {"<<"}
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Página anterior</span>
              {"<"}
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Próxima página</span>
              {">"}
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir para última página</span>
              {">>"}
            </Button>
          </div>
        </div>
      </div>

      {selectedLead && (
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
      )}

      {selectedLead && (
        <ChangeStatusDialog
          open={showChangeStatusDialog}
          onOpenChange={setShowChangeStatusDialog}
          lead={selectedLead}
          statusLabels={statusLabels}
          onStatusChanged={refreshLeads}
          closers={closers}
          teamMembers={[]}
          onSchedulePatched={applyScheduledPatch}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o lead{" "}
              <strong className="text-foreground">"{leadToDelete?.name ?? "selecionado"}"</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLead}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingLead || !leadToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteLead();
              }}
            >
              {isDeletingLead ? "Deletando..." : "Deletar lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
