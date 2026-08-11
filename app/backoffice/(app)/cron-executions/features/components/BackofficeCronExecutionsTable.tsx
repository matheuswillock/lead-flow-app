"use client"

import { useMemo, useState } from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCronExecutions } from "../context/useCronExecutionsHook"
import {
  formatCronExecutionDateTime,
  formatCronExecutionDuration,
  type CronExecutionItem,
} from "../context/CronExecutionsContextTypes"
import { BackofficeCronStatusBadge } from "./BackofficeCronStatusBadge"

const SKELETON_ROW_COUNT = 8
const headerButtonClass = "h-8 w-full justify-center px-2 hover:bg-accent"

function SortableHeader({
  column,
  label,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc"
    toggleSorting: (desc?: boolean) => void
  }
  label: string
}) {
  const sorted = column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={headerButtonClass}
    >
      {label}
      <Icon data-icon="inline-end" />
    </Button>
  )
}

export function BackofficeCronExecutionsTable() {
  const { filteredExecutions, loading, selectExecution } = useCronExecutions()
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<CronExecutionItem>[]>(
    () => [
      {
        accessorKey: "cronKey",
        header: ({ column }) => <SortableHeader column={column} label="Cron" />,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.original.cronKey}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.cronPath}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader column={column} label="Status" />,
        cell: ({ row }) => <BackofficeCronStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "startedAt",
        header: ({ column }) => <SortableHeader column={column} label="Início" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatCronExecutionDateTime(row.original.startedAt)}
          </span>
        ),
      },
      {
        accessorKey: "durationMs",
        header: ({ column }) => <SortableHeader column={column} label="Duração" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatCronExecutionDuration(row.original.durationMs)}
          </span>
        ),
      },
      {
        accessorKey: "errorSummary",
        header: "Erro",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {row.original.errorSummary || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Ações",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              selectExecution(row.original)
            }}
          >
            Ver detalhes
          </Button>
        ),
      },
    ],
    [selectExecution]
  )

  const table = useReactTable({
    data: filteredExecutions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })

  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1)
  const pageCount = Math.max(table.getPageCount(), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-center align-middle">
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
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                <TableRow key={`cron-execution-skeleton-${rowIndex}`}>
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell key={column.id} className="text-center align-middle">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => selectExecution(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-center align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="h-24 text-center">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end px-2">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Linhas por página</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[76px]" aria-label="Linhas por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Página {table.getState().pagination.pageIndex + 1} de {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir para primeira página</span>
              <ChevronsLeft data-icon="inline-start" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Página anterior</span>
              <ChevronLeft data-icon="inline-start" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Próxima página</span>
              <ChevronRight data-icon="inline-start" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir para última página</span>
              <ChevronsRight data-icon="inline-start" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
