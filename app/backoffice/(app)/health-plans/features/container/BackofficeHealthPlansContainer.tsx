"use client"

import { useMemo, useState } from "react"
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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle,
  CircleOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Pencil,
  Plus,
  PlusCircle,
  Settings,
  Star,
  Upload,
  X,
} from "lucide-react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useBackofficeHealthPlans } from "../context/BackofficeHealthPlansContext"
import type { BackofficeHealthPlanItem } from "../services/IBackofficeHealthPlansService"
import { cn } from "@/lib/utils"

const SYSTEM_HEALTH_PLAN_NORMALIZED_NAMES = new Set(["novaadesao", "outros"])

const isSystemHealthPlan = (normalizedName: string) =>
  SYSTEM_HEALTH_PLAN_NORMALIZED_NAMES.has(normalizedName)

type FormState = {
  id?: string
  name: string
  iconUrl: string
  isDefault: boolean
  isSystem?: boolean
}

const emptyForm: FormState = {
  name: "",
  iconUrl: "",
  isDefault: false,
  isSystem: false,
}

const HEALTH_PLAN_COLUMN_OPTIONS = [
  { key: "name", label: "Operadora" },
  { key: "status", label: "Status" },
  { key: "default", label: "Default" },
  { key: "createdAt", label: "Criado em" },
  { key: "activatedAt", label: "Ativado em" },
  { key: "deactivatedAt", label: "Inativado em" },
] as const

type HealthPlanColumnKey = (typeof HEALTH_PLAN_COLUMN_OPTIONS)[number]["key"]
type HealthPlanColumnVisibility = Record<HealthPlanColumnKey, boolean>

const DEFAULT_HEALTH_PLAN_COLUMN_VISIBILITY: HealthPlanColumnVisibility = {
  name: true,
  status: true,
  default: true,
  createdAt: true,
  activatedAt: true,
  deactivatedAt: true,
}

const DEFAULT_HEALTH_PLAN_COLUMN_ORDER: Array<HealthPlanColumnKey | "actions"> = [
  "name",
  "status",
  "default",
  "createdAt",
  "activatedAt",
  "deactivatedAt",
  "actions",
]

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

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return "—"
  }
}

export function BackofficeHealthPlansContainer() {
  const { items, isLoading, isSaving, canManage, createItem, updateItem, deactivateItem, activateItem, uploadIcon } = useBackofficeHealthPlans()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [defaultFilter, setDefaultFilter] = useState<"all" | "default" | "non_default">("all")
  const [sorting, setSorting] = useState<SortingState>([])
  const [tableColumnVisibility, setTableColumnVisibility] = useState<HealthPlanColumnVisibility>(
    DEFAULT_HEALTH_PLAN_COLUMN_VISIBILITY
  )
  const [tableColumnOrder, setTableColumnOrder] = useState<Array<HealthPlanColumnKey | "actions">>(
    DEFAULT_HEALTH_PLAN_COLUMN_ORDER
  )
  const [isUploading, setIsUploading] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusPassword, setStatusPassword] = useState("")
  const [statusTarget, setStatusTarget] = useState<BackofficeHealthPlanItem | null>(null)
  const [statusAction, setStatusAction] = useState<"activate" | "deactivate">("deactivate")
  const statusLabel = statusFilter === "all" ? null : statusFilter === "active" ? "Ativas" : "Inativas"
  const defaultLabel = defaultFilter === "all" ? null : defaultFilter === "default" ? "Sim" : "Não"

  const defaultItem = useMemo(() => items.find((item) => item.isDefault && item.isActive) ?? null, [items])
  const normalizedNameSet = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      map.set(item.id, item.name.trim().toLocaleLowerCase("pt-BR"))
    })
    return map
  }, [items])
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const statusMatch =
        statusFilter === "all" ? true : statusFilter === "active" ? item.isActive : !item.isActive
      if (!statusMatch) return false
      const defaultMatch =
        defaultFilter === "all" ? true : defaultFilter === "default" ? item.isDefault : !item.isDefault
      if (!defaultMatch) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q)
    })
  }, [defaultFilter, items, query, statusFilter])

  function startCreate() {
    setForm(emptyForm)
    setOpen(true)
  }

  function startEdit(item: BackofficeHealthPlanItem) {
    setForm({
      id: item.id,
      name: item.name,
      iconUrl: item.iconUrl ?? "",
      isDefault: item.isDefault,
      isSystem: isSystemHealthPlan(item.normalizedName),
    })
    setOpen(true)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedName = form.name.trim()
    const normalizedCandidate = trimmedName.toLocaleLowerCase("pt-BR")
    const hasDuplicate = Array.from(normalizedNameSet.entries()).some(
      ([id, value]) => value === normalizedCandidate && id !== form.id
    )

    if (!trimmedName) {
      toast.error("Nome da operadora é obrigatório")
      return
    }

    if (hasDuplicate) {
      toast.error("Operadora já cadastrada")
      return
    }

    const payload = {
      name: trimmedName,
      iconUrl: form.iconUrl.trim() || null,
      isDefault: form.isSystem ? undefined : form.isDefault,
    }
    const result = form.id ? await updateItem(form.id, payload) : await createItem(payload)
    if (!result.isValid) {
      toast.error(result.errorMessages?.[0] ?? "Erro ao salvar operadora")
      return
    }
    toast.success(form.id ? "Operadora atualizada com sucesso" : "Operadora criada com sucesso")
    setOpen(false)
    setForm(emptyForm)
  }

  async function handleStatusAction() {
    if (!statusTarget || !statusPassword.trim()) return

    const result =
      statusAction === "deactivate"
        ? await deactivateItem(statusTarget.id, statusPassword)
        : await activateItem(statusTarget.id, statusPassword)

    if (!result.isValid) {
      toast.error(
        result.errorMessages?.[0] ??
          (statusAction === "deactivate" ? "Erro ao inativar operadora" : "Erro ao ativar operadora")
      )
      return
    }
    toast.success(statusAction === "deactivate" ? "Operadora inativada com sucesso" : "Operadora ativada com sucesso")
    setStatusDialogOpen(false)
    setStatusPassword("")
    setStatusTarget(null)
  }

  async function handleIconUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const result = await uploadIcon(file)
      if (!result.isValid || !result.result?.iconUrl) {
        toast.error(result.errorMessages?.[0] ?? "Erro ao enviar ícone")
        return
      }
      setForm((prev) => ({ ...prev, iconUrl: result.result?.iconUrl ?? "" }))
      toast.success("Ícone enviado com sucesso")
    } finally {
      setIsUploading(false)
    }
  }

  const columns = useMemo<ColumnDef<BackofficeHealthPlanItem>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => <SortableHeader column={column} label="Operadora" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.iconUrl ? (
              <img src={row.original.iconUrl} alt={row.original.name} className="size-8 rounded-md border object-cover" />
            ) : (
              <div className="size-8 rounded-md border bg-muted" />
            )}
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        id: "status",
        header: ({ column }) => <SortableHeader column={column} label="Status" />,
        cell: ({ row }) => row.original.isActive ? (
          <span className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-500">
            <CheckCircle className="size-4" />
            Ativa
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
            <CircleOff className="size-4" />
            Inativa
          </span>
        ),
      },
      {
        accessorKey: "isDefault",
        id: "default",
        header: ({ column }) => <SortableHeader column={column} label="Default" />,
        cell: ({ row }) => row.original.isDefault ? (
          <Star className="mx-auto size-4 fill-primary text-primary" />
        ) : (
          <Star className="mx-auto size-4 text-muted-foreground/30" />
        ),
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => <SortableHeader column={column} label="Criado em" />,
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        accessorKey: "activatedAt",
        id: "activatedAt",
        header: ({ column }) => <SortableHeader column={column} label="Ativado em" />,
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.activatedAt)}</span>,
      },
      {
        accessorKey: "deactivatedAt",
        id: "deactivatedAt",
        header: ({ column }) => <SortableHeader column={column} label="Inativado em" />,
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.deactivatedAt)}</span>,
      },
      {
        id: "actions",
        header: () => <span className="text-center">Ações</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => canManage ? (
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
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.stopPropagation()
                    startEdit(row.original)
                  }}
                >
                  <Pencil data-icon="inline-start" />
                  Editar operadora
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {!isSystemHealthPlan(row.original.normalizedName) && (
                row.original.isActive ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={(event) => {
                          event.stopPropagation()
                          setStatusAction("deactivate")
                          setStatusTarget(row.original)
                          setStatusPassword("")
                          setStatusDialogOpen(true)
                        }}
                      >
                        <CircleOff data-icon="inline-start" />
                        Inativar operadora
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.stopPropagation()
                          setStatusAction("activate")
                          setStatusTarget(row.original)
                          setStatusPassword("")
                          setStatusDialogOpen(true)
                        }}
                      >
                        <Check data-icon="inline-start" />
                        Ativar operadora
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
      },
    ],
    [activateItem, canManage, deactivateItem]
  )

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: {
      sorting,
      columnVisibility: {
        name: tableColumnVisibility.name,
        status: tableColumnVisibility.status,
        default: tableColumnVisibility.default,
        createdAt: tableColumnVisibility.createdAt,
        activatedAt: tableColumnVisibility.activatedAt,
        deactivatedAt: tableColumnVisibility.deactivatedAt,
      },
      columnOrder: tableColumnOrder,
    },
    onSortingChange: setSorting,
    onColumnOrderChange: (value) =>
      setTableColumnOrder((typeof value === "function" ? value(tableColumnOrder) : value) as Array<HealthPlanColumnKey | "actions">),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })
  const pageCount = Math.max(table.getPageCount(), 1)
  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1)

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Operadoras</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie catálogo de operadoras, ícone e tag default.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" onClick={startCreate}>
              <Plus data-icon="inline-start" />
              Nova operadora
            </Button>
          )}
        <Sheet>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="Configuração das colunas da tabela">
                    <Settings data-icon="inline-start" />
                  </Button>
                </SheetTrigger>
              </TooltipTrigger>
              <TooltipContent>Configuração das colunas</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <SheetContent side="right" className="w-105 sm:w-115">
            <SheetHeader>
              <SheetTitle>Configuração das colunas</SheetTitle>
              <SheetDescription>Selecione quais headers devem aparecer na tabela de Operadoras.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3">
              {HEALTH_PLAN_COLUMN_OPTIONS.map((option) => (
                <div key={option.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`backoffice-health-plan-column-${option.key}`}
                      checked={tableColumnVisibility[option.key] !== false}
                      onCheckedChange={(value) =>
                        setTableColumnVisibility((prev) => ({ ...prev, [option.key]: value === true }))
                      }
                    />
                    <Label htmlFor={`backoffice-health-plan-column-${option.key}`} className="text-sm font-medium leading-none">
                      {option.label}
                    </Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label={`Subir coluna ${option.label}`}
                      onClick={() => {
                        setTableColumnOrder((prev) => {
                          const order = [...prev]
                          const from = order.indexOf(option.key)
                          const firstContentIndex = order.indexOf("name")
                          if (from <= firstContentIndex) return order
                          const temp = order[from - 1]
                          order[from - 1] = order[from]
                          order[from] = temp
                          return order
                        })
                      }}
                    >
                      <ArrowUp data-icon="inline-start" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label={`Descer coluna ${option.label}`}
                      onClick={() => {
                        setTableColumnOrder((prev) => {
                          const order = [...prev]
                          const from = order.indexOf(option.key)
                          const lastContentIndex = order.indexOf("deactivatedAt")
                          if (from < 0 || from >= lastContentIndex) return order
                          const temp = order[from + 1]
                          order[from + 1] = order[from]
                          order[from] = temp
                          return order
                        })
                      }}
                    >
                      <ArrowDown data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Isso afeta apenas a tabela de Operadoras do backoffice.</p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTableColumnVisibility(DEFAULT_HEALTH_PLAN_COLUMN_VISIBILITY)
                    setTableColumnOrder(DEFAULT_HEALTH_PLAN_COLUMN_ORDER)
                  }}
                >
                  Restaurar padrão
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por nome da operadora"
          className="h-8 w-full max-w-sm"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 border-dashed", statusLabel && "border-primary")}
            >
              <PlusCircle data-icon="inline-start" />
              Status
              {statusLabel ? (
                <>
                  <Separator orientation="vertical" className="mx-2 h-4" />
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {statusLabel}
                  </Badge>
                </>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-55 p-0" align="start">
            <Command>
              <CommandList>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => setStatusFilter("active")}>
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        statusFilter === "active"
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <span>Ativas</span>
                  </CommandItem>
                  <CommandItem onSelect={() => setStatusFilter("inactive")}>
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        statusFilter === "inactive"
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <span>Inativas</span>
                  </CommandItem>
                </CommandGroup>
                {statusLabel ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => setStatusFilter("all")} className="justify-center text-center">
                        Limpar filtros
                      </CommandItem>
                    </CommandGroup>
                  </>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 border-dashed", defaultLabel && "border-primary")}
            >
              <PlusCircle data-icon="inline-start" />
              Default
              {defaultLabel ? (
                <>
                  <Separator orientation="vertical" className="mx-2 h-4" />
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {defaultLabel}
                  </Badge>
                </>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-0" align="start">
            <Command>
              <CommandList>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => setDefaultFilter("default")}>
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        defaultFilter === "default"
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <span>Sim</span>
                  </CommandItem>
                  <CommandItem onSelect={() => setDefaultFilter("non_default")}>
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        defaultFilter === "non_default"
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <span>Não</span>
                  </CommandItem>
                </CommandGroup>
                {defaultLabel ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => setDefaultFilter("all")} className="justify-center text-center">
                        Limpar filtros
                      </CommandItem>
                    </CommandGroup>
                  </>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

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
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 4 }).map((__, skeletonIndex) => (
                    <TableCell key={skeletonIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="h-24 text-center text-muted-foreground">
                  Nenhuma operadora cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={canManage ? "cursor-pointer" : undefined}
                  onClick={canManage ? () => startEdit(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-center align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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
              <SelectTrigger className="w-19" aria-label="Linhas por página">
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
          <div className="flex w-25 items-center justify-center text-sm font-medium">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar operadora" : "Nova operadora"}</DialogTitle>
            <DialogDescription>
              {defaultItem && !form.isDefault ? `Default atual: ${defaultItem.name}.` : "Configure nome, ícone e default."}
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="operadora-name">Nome</Label>
              <Input
                id="operadora-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                onBlur={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value.trim() }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="operadora-icon-file">Ícone</Label>
              <div className="flex items-center gap-2">
                {form.iconUrl ? (
                  <img src={form.iconUrl} alt="Ícone da operadora" className="size-16 rounded-lg border object-cover" />
                ) : (
                  <div className="size-16 rounded-lg border bg-muted" />
                )}
                <Label
                  htmlFor="operadora-icon-file"
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"
                >
                  <Upload className="size-4" />
                  {isUploading ? "Enviando..." : "Upload ícone"}
                </Label>
                <Input id="operadora-icon-file" type="file" className="hidden" accept="image/*" onChange={handleIconUpload} disabled={isUploading} />
                {form.iconUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((prev) => ({ ...prev, iconUrl: "" }))} disabled={isUploading}>
                    <X />
                    Remover ícone
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {form.isSystem ? (
                <Button type="button" variant="default" disabled>
                  <Star data-icon="inline-start" className="fill-primary-foreground" />
                  Default
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={form.isDefault ? "default" : "outline"}
                  onClick={() => setForm((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
                >
                  <Star
                    data-icon="inline-start"
                    className={form.isDefault ? "fill-primary-foreground" : ""}
                  />
                  {form.isDefault ? "Default" : "Marcar como default"}
                </Button>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || isUploading}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={statusDialogOpen}
        onOpenChange={(openState) => {
          if (!isSaving) setStatusDialogOpen(openState)
          if (!openState) {
            setStatusPassword("")
            setStatusTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusAction === "deactivate" ? "Inativar operadora?" : "Ativar operadora?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusAction === "deactivate"
                ? "Digite sua senha para confirmar a inativação."
                : "Digite sua senha para confirmar a ativação."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="health-plan-action-password">Digite sua senha</Label>
            <Input
              id="health-plan-action-password"
              type="password"
              value={statusPassword}
              onChange={(event) => setStatusPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Sua senha"
              disabled={isSaving}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving || !statusPassword.trim()}
              onClick={(event) => {
                event.preventDefault()
                void handleStatusAction()
              }}
            >
              {isSaving ? "Confirmando..." : "Confirmar ação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}