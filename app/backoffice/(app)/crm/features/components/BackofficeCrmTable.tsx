"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  History,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Tag,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTimezone } from "@/app/context/TimezoneContext"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import { BackofficeLeadScheduleDialog } from "./BackofficeLeadScheduleDialog"
import { BackofficeGenerateOfferDialog } from "./BackofficeGenerateOfferDialog"
import { BackofficeLeadOffersSheet } from "./BackofficeLeadOffersSheet"
import {
  BACKOFFICE_CRM_COLUMNS,
  BACKOFFICE_CRM_STATUS_LABELS,
  DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER,
  DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY,
  type BackofficeCrmTableColumnKey,
  type BackofficeLeadItem,
  type BackofficeLeadScheduleInput,
  type BackofficeLeadStatusKey,
} from "../context/BackofficeCrmTypes"
import { formatDateTime } from "@/lib/dates/formatters"
import { formatDocumentInput, maskPhone } from "@/lib/masks"

const TABLE_COLUMN_OPTIONS: { key: BackofficeCrmTableColumnKey; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "cpfCnpj", label: "Documento" },
  { key: "status", label: "Status" },
  { key: "origin", label: "Origem" },
  { key: "sdr", label: "SDR" },
  { key: "closer", label: "Closer" },
  { key: "meetingDate", label: "Agendamento" },
  { key: "notes", label: "Observações" },
  { key: "createdAt", label: "Criado em" },
  { key: "updatedAt", label: "Atualizado em" },
]

const headerButtonClass = "h-8 w-full justify-center px-2 hover:bg-accent"

function getStatusBadgeClass(status: BackofficeLeadStatusKey): string {
  const classes: Record<BackofficeLeadStatusKey, string> = {
    new_opportunity: "border-primary/30 bg-primary/10 text-primary",
    scheduled: "border-primary/30 bg-primary text-primary-foreground",
    no_show: "border-muted bg-muted text-muted-foreground",
    new_adhesion: "border-primary/30 bg-primary/15 text-primary",
    lost: "border-destructive/30 bg-destructive/10 text-destructive",
    implementation: "border-border bg-secondary text-secondary-foreground",
    finalized: "border-primary/30 bg-primary/15 text-primary",
  }
  return classes[status]
}

function getOriginLabel(origin: BackofficeLeadItem["origin"]): string {
  switch (origin) {
    case "webhook_meta":
      return "Webhook Meta"
    case "landing_page":
      return "Landing page"
    case "public_form":
      return "Formulário público"
    case "manual":
      return "Manual"
    default: {
      const _exhaustive: never = origin
      return _exhaustive
    }
  }
}

function getOriginBadgeClass(origin: BackofficeLeadItem["origin"]): string {
  switch (origin) {
    case "webhook_meta":
      return "border-primary/30 bg-primary/10 text-primary"
    case "landing_page":
    case "public_form":
      return "border-primary/20 bg-primary/5 text-primary"
    case "manual":
      return "border-border bg-muted text-muted-foreground"
    default: {
      const _exhaustive: never = origin
      return _exhaustive
    }
  }
}

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

function DragHandle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="cursor-grab active:cursor-grabbing"
      aria-label="Arrastar para reordenar"
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical data-icon="inline-start" />
    </Button>
  )
}

function SortableColumnOption({
  option,
  isChecked,
  onCheckedChange,
}: {
  option: (typeof TABLE_COLUMN_OPTIONS)[number]
  isChecked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const checkboxId = `backoffice-crm-column-${option.key}`
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: option.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

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
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-7 cursor-grab active:cursor-grabbing"
        aria-label={`Reordenar coluna ${option.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical data-icon="inline-start" />
      </Button>
    </div>
  )
}

export function BackofficeCrmColumnSettingsButton() {
  const {
    tableColumnVisibility,
    setTableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
  } = useBackofficeCrm()
  const sensors = useSensors(useSensor(PointerSensor))

  const orderedColumnOptions = useMemo(() => {
    const optionMap = new Map(TABLE_COLUMN_OPTIONS.map((option) => [option.key, option]))
    const sorted: (typeof TABLE_COLUMN_OPTIONS)[number][] = []

    tableColumnOrder.forEach((columnId) => {
      const option = optionMap.get(columnId as BackofficeCrmTableColumnKey)
      if (option) {
        sorted.push(option)
        optionMap.delete(columnId as BackofficeCrmTableColumnKey)
      }
    })
    optionMap.forEach((option) => sorted.push(option))

    return sorted
  }, [tableColumnOrder])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentOrder = orderedColumnOptions.map((option) => option.key)
    const oldIndex = currentOrder.indexOf(active.id as BackofficeCrmTableColumnKey)
    const newIndex = currentOrder.indexOf(over.id as BackofficeCrmTableColumnKey)
    if (oldIndex < 0 || newIndex < 0) return

    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex)
    setTableColumnOrder((prev) => {
      const hasDrag = prev.includes("drag")
      const hasActions = prev.includes("actions")
      return [
        ...(hasDrag ? ["drag"] : []),
        ...nextOrder,
        ...(hasActions ? ["actions"] : []),
      ]
    })
  }

  return (
    <Sheet>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Configuração das colunas da tabela"
              >
                <Settings data-icon="inline-start" />
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
            Selecione quais headers devem aparecer na tabela do CRM.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedColumnOptions.map((option) => option.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3">
                {orderedColumnOptions.map((option) => (
                  <SortableColumnOption
                    key={option.key}
                    option={option}
                    isChecked={tableColumnVisibility[option.key] !== false}
                    onCheckedChange={(nextChecked) => {
                      setTableColumnVisibility((prev) => ({
                        ...prev,
                        [option.key]: nextChecked,
                      }))
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-xs text-muted-foreground">
            Isso afeta apenas a tabela do CRM do backoffice.
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTableColumnVisibility(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY)
                setTableColumnOrder(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER)
              }}
            >
              Restaurar padrão
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function BackofficeCrmTable() {
  const {
    filteredLeads,
    users,
    closerOptions,
    canManage,
    openEditDialog,
    updateLeadStatus,
    removeLead,
    tableColumnVisibility,
    setTableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
  } = useBackofficeCrm()
  const { tz } = useTimezone()
  const [sorting, setSorting] = useState<SortingState>([])
  const [data, setData] = useState<BackofficeLeadItem[]>(filteredLeads)
  const [leadToDelete, setLeadToDelete] = useState<BackofficeLeadItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeletingLead, setIsDeletingLead] = useState(false)
  const [pendingStatusLeadId, setPendingStatusLeadId] = useState<string | null>(null)
  const [leadToSchedule, setLeadToSchedule] = useState<BackofficeLeadItem | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [offerLead, setOfferLead] = useState<BackofficeLeadItem | null>(null)
  const [generateOfferOpen, setGenerateOfferOpen] = useState(false)
  const [offersHistoryOpen, setOffersHistoryOpen] = useState(false)

  useEffect(() => {
    setData(filteredLeads)
  }, [filteredLeads])

  const handleStatusChange = useCallback(
    async (lead: BackofficeLeadItem, status: BackofficeLeadStatusKey) => {
      if (pendingStatusLeadId || lead.status === status) return

      if (status === "scheduled") {
        setLeadToSchedule(lead)
        setScheduleDialogOpen(true)
        return
      }

      setPendingStatusLeadId(lead.id)
      try {
        await updateLeadStatus(lead.id, status)
      } catch (err) {
        console.error("[BackofficeCrmTable][handleStatusChange]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar status")
      } finally {
        setPendingStatusLeadId(null)
      }
    },
    [pendingStatusLeadId, updateLeadStatus]
  )

  const confirmScheduleStatusChange = useCallback(
    async (schedule: BackofficeLeadScheduleInput) => {
      if (!leadToSchedule) return

      setPendingStatusLeadId(leadToSchedule.id)
      try {
        await updateLeadStatus(leadToSchedule.id, "scheduled", schedule)
        setScheduleDialogOpen(false)
        setLeadToSchedule(null)
      } finally {
        setPendingStatusLeadId(null)
      }
    },
    [leadToSchedule, updateLeadStatus]
  )

  function handleDeleteDialogOpenChange(open: boolean) {
    if (isDeletingLead) return
    setDeleteDialogOpen(open)
    if (!open) {
      setLeadToDelete(null)
    }
  }

  async function confirmDeleteLead() {
    if (!leadToDelete || isDeletingLead) return

    setIsDeletingLead(true)
    try {
      await removeLead(leadToDelete.id)
      setDeleteDialogOpen(false)
      setLeadToDelete(null)
    } catch (err) {
      console.error("[BackofficeCrmTable][confirmDeleteLead]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao remover lead")
    } finally {
      setIsDeletingLead(false)
    }
  }

  const columns = useMemo<ColumnDef<BackofficeLeadItem>[]>(
    () => [
      {
        id: "drag",
        header: () => null,
        cell: () => <DragHandle />,
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        meta: { label: "Nome" },
        header: ({ column }) => <SortableHeader column={column} label="Nome" />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        meta: { label: "Email" },
        header: ({ column }) => <SortableHeader column={column} label="Email" />,
        cell: ({ row }) => row.original.email || "-",
      },
      {
        accessorKey: "phone",
        meta: { label: "Telefone" },
        header: ({ column }) => <SortableHeader column={column} label="Telefone" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{maskPhone(row.original.phone ?? "") || "-"}</span>
        ),
      },
      {
        accessorKey: "cpfCnpj",
        meta: { label: "Documento" },
        header: ({ column }) => <SortableHeader column={column} label="Documento" />,
        cell: ({ row }) => formatDocumentInput(row.original.cpfCnpj),
      },
      {
        accessorKey: "status",
        meta: { label: "Status" },
        header: ({ column }) => <SortableHeader column={column} label="Status" />,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("font-medium", getStatusBadgeClass(row.original.status))}
          >
            {BACKOFFICE_CRM_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "origin",
        meta: { label: "Origem" },
        header: ({ column }) => <SortableHeader column={column} label="Origem" />,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("font-medium", getOriginBadgeClass(row.original.origin))}
          >
            {getOriginLabel(row.original.origin)}
          </Badge>
        ),
      },
      {
        accessorKey: "sdr",
        meta: { label: "SDR" },
        header: ({ column }) => <SortableHeader column={column} label="SDR" />,
        cell: ({ row }) => row.original.sdr?.name ?? "-",
      },
      {
        accessorKey: "closer",
        meta: { label: "Closer" },
        header: ({ column }) => <SortableHeader column={column} label="Closer" />,
        cell: ({ row }) => row.original.closer?.name ?? "-",
      },
      {
        accessorKey: "meetingDate",
        meta: { label: "Agendamento" },
        header: ({ column }) => <SortableHeader column={column} label="Agendamento" />,
        cell: ({ row }) =>
          row.original.meetingDate ? formatDateTime(row.original.meetingDate, tz) : "-",
      },
      {
        accessorKey: "notes",
        meta: { label: "Observações" },
        header: ({ column }) => <SortableHeader column={column} label="Observações" />,
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {row.original.notes || "-"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Criado em" },
        header: ({ column }) => <SortableHeader column={column} label="Criado em" />,
        cell: ({ row }) => formatDateTime(row.original.createdAt, tz),
      },
      {
        accessorKey: "updatedAt",
        meta: { label: "Atualizado em" },
        header: ({ column }) => <SortableHeader column={column} label="Atualizado em" />,
        cell: ({ row }) => formatDateTime(row.original.updatedAt, tz),
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const lead = row.original
          const isStatusPending = pendingStatusLeadId === lead.id

          if (!canManage) return null

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <Button variant="ghost" size="icon" aria-label="Abrir ações">
                  <MoreHorizontal data-icon="inline-start" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger onClick={(event) => event.stopPropagation()}>
                      <RefreshCw data-icon="inline-start" />
                      Mudar status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuGroup>
                        {BACKOFFICE_CRM_COLUMNS.map((status) => (
                          <DropdownMenuItem
                            key={status.key}
                            disabled={isStatusPending || lead.status === status.key}
                            onSelect={(event) => {
                              event.stopPropagation()
                              void handleStatusChange(lead, status.key)
                            }}
                          >
                            {lead.status === status.key ? (
                              <CheckCircle2 data-icon="inline-start" />
                            ) : null}
                            {status.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.stopPropagation()
                      setOfferLead(lead)
                      setGenerateOfferOpen(true)
                    }}
                  >
                    <Tag data-icon="inline-start" />
                    Gerar oferta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.stopPropagation()
                      setOfferLead(lead)
                      setOffersHistoryOpen(true)
                    }}
                  >
                    <History data-icon="inline-start" />
                    Histórico de ofertas
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={(event) => {
                      event.stopPropagation()
                      setLeadToDelete(lead)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remover lead
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [canManage, handleStatusChange, pendingStatusLeadId, tz],
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility: tableColumnVisibility,
      columnOrder: tableColumnOrder,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setTableColumnVisibility,
    onColumnOrderChange: setTableColumnOrder,
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={canManage ? "cursor-pointer" : undefined}
                  onClick={canManage ? () => openEditDialog(row.original) : undefined}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o lead{" "}
              <strong className="text-foreground">
                "{leadToDelete?.name ?? "selecionado"}"
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLead}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingLead || !leadToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteLead()
              }}
            >
              {isDeletingLead ? "Removendo..." : "Remover lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BackofficeLeadScheduleDialog
        open={scheduleDialogOpen}
        lead={leadToSchedule}
        closerOptions={closerOptions}
        guestOptions={users}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open)
          if (!open) setLeadToSchedule(null)
        }}
        onConfirm={confirmScheduleStatusChange}
        isReschedule={leadToSchedule?.status === "scheduled"}
      />

      <BackofficeGenerateOfferDialog
        lead={offerLead}
        open={generateOfferOpen}
        onOpenChange={(open) => {
          setGenerateOfferOpen(open)
          if (!open && !offersHistoryOpen) setOfferLead(null)
        }}
      />

      <BackofficeLeadOffersSheet
        lead={offerLead}
        open={offersHistoryOpen}
        onOpenChange={(open) => {
          setOffersHistoryOpen(open)
          if (!open && !generateOfferOpen) setOfferLead(null)
        }}
        onGenerateNew={() => {
          setOffersHistoryOpen(false)
          setGenerateOfferOpen(true)
        }}
      />
    </div>
  )
}
