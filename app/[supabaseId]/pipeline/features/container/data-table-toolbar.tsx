'use client';

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableDateFilter } from "./data-table-date-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  statusOptions: { label: string; value: string; }[];
  responsibleOptions: { label: string; value: string; }[];
}

export function DataTableToolbar<TData>({
  table,
  statusOptions,
  responsibleOptions,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filtrar por nome..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions}
          />
        )}
        {table.getColumn("assignedTo") && responsibleOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("assignedTo")}
            title="Responsável"
            options={responsibleOptions}
          />
        )}
        {table.getColumn("createdAt") && (
          <DataTableDateFilter
            column={table.getColumn("createdAt")}
            title="Data de Criação"
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Limpar
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
