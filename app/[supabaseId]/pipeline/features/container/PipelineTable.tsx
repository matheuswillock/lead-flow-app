'use client';

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
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
import usePipelineContext from "../context/PipelineHook";
import { Lead } from "../context/PipelineTypes";
// import { createColumns } from "./columns";
import { DataTableToolbar } from "./data-table-toolbar";
import { DraggableRow } from "./DraggableRow";
import { toast } from "sonner";
import { useState } from "react";
import { ScheduleMeetingDialog } from "@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { createColumns } from "./PipelineColumns";

export default function PipelineTable() {
  const { 
    filtered, 
    handleRowClick, 
    statusLabels, 
    isLoading,
    setSelected,
    refreshLeads,
    user,
    errors,
  } = usePipelineContext();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [data, setData] = React.useState<Lead[]>(filtered);
  
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showChangeStatusDialog, setShowChangeStatusDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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
    const uniqueResponsibles = new Map<string, { id: string; name: string }>();
    
    filtered.forEach((lead) => {
      if (lead.assignee) {
        const name = lead.assignee.fullName || lead.assignee.email;
        if (!uniqueResponsibles.has(lead.assignee.id)) {
          uniqueResponsibles.set(lead.assignee.id, {
            id: lead.assignee.id,
            name: name,
          });
        }
      }
    });

    return Array.from(uniqueResponsibles.values()).map(({ id, name }) => ({
      label: name,
      value: id,
    }));
  }, [filtered]);

  const closers = React.useMemo(() => {
    const users = user?.usersAssociated || [];
    return users.filter((u) => u.functions?.includes("CLOSER"));
  }, [user]);

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
    setShowScheduleDialog(true);
  };

  const handleRescheduleMeeting = (lead: Lead) => {
    setSelectedLead(lead);
    setShowScheduleDialog(true);
  };

  const handleDeleteLead = async (lead: Lead) => {
    if (!confirm(`Tem certeza que deseja deletar o lead "${lead.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar lead');
      }

      toast.success('Lead deletado com sucesso!');
      await refreshLeads();
    } catch (error) {
      toast.error('Erro ao deletar lead');
      console.error('Erro ao deletar lead:', error);
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
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando leads...</p>
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
      <DataTableToolbar 
        table={table} 
        statusOptions={statusOptions}
        responsibleOptions={responsibleOptions}
        closerOptions={closerOptions}
      />
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
                    return (
                      <TableHead key={header.id} className="text-center align-middle">
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
          onOpenChange={setShowScheduleDialog}
          lead={selectedLead}
          onScheduleSuccess={refreshLeads}
          closers={closers}
          teamMembers={user?.usersAssociated ?? []}
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
          teamMembers={user?.usersAssociated ?? []}
        />
      )}
    </div>
  );
}
