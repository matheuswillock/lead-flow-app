"use client";

import * as React from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableToolbar } from "./components/DataTableToolbar";
import { DataTablePagination } from "./components/DataTablePagination";
import type { DataTableToolbarConfig } from "./types";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  toolbar?: DataTableToolbarConfig;
  loadingText: string;
  emptyText: string;
  countText: (count: number) => string;
  getRowClassName?: (row: TData) => string;
  /**
   * Clique (ou Enter/espaço) na linha abre o detalhe do item, no lugar do menu "⋯". Cliques em
   * botões, links e campos dentro da linha seguem o comportamento deles.
   */
  onRowClick?: (row: TData) => void;
  /** Nome acessível da linha clicável, ex.: "Ver detalhes de Ana Souza". */
  getRowLabel?: (row: TData) => string;
  /**
   * Colunas que começam ocultas (continuam filtrando e podem ser reexibidas em "Colunas"). Use para
   * manter a tabela sem rolagem lateral: o detalhe fica no painel aberto pela linha.
   */
  initialHiddenColumns?: string[];
}

/**
 * Classe da coluna aplicada no cabeçalho e nas células, via `meta.className` da coluna — por
 * exemplo "hidden md:table-cell" para a coluna sumir no celular em vez de criar rolagem lateral.
 */
function columnClassName(meta: unknown): string | undefined {
  return (meta as { className?: string } | undefined)?.className;
}

const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, label, [role='button'], [role='checkbox'], [role='menuitem']";

/** O clique veio de um controle dentro da linha (não da linha em si)? */
function isFromInnerControl(event: React.SyntheticEvent): boolean {
  const target = event.target as HTMLElement | null;
  const control = target?.closest(INTERACTIVE_SELECTOR);
  return Boolean(control && control !== event.currentTarget);
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  toolbar,
  loadingText,
  emptyText,
  countText,
  getRowClassName,
  onRowClick,
  getRowLabel,
  initialHiddenColumns,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() =>
    Object.fromEntries((initialHiddenColumns ?? []).map((columnId) => [columnId, false]))
  );
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <DataTableToolbar table={table} config={toolbar} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={columnClassName(header.column.columnDef.meta)}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {loadingText}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    getRowClassName?.(row.original),
                    onRowClick &&
                      "cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  )}
                  {...(onRowClick
                    ? {
                        tabIndex: 0,
                        "aria-label": getRowLabel?.(row.original),
                        onClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
                          if (!isFromInnerControl(event)) onRowClick(row.original);
                        },
                        onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                          if ((event.key === "Enter" || event.key === " ") && !isFromInnerControl(event)) {
                            event.preventDefault();
                            onRowClick(row.original);
                          }
                        },
                      }
                    : {})}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={columnClassName(cell.column.columnDef.meta)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} countText={countText} />
    </div>
  );
}

