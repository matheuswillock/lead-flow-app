'use client';

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreHorizontal, Calendar, Trash2, CheckCircle, GripVertical, RefreshCw, MessageCircle, Phone } from "lucide-react";
import { Lead } from "../context/PipelineTypes";
import { formatDate } from "../context/PipelineContext";
import { DraftLeadIndicator } from "@/app/[supabaseId]/components/DraftLeadIndicator";
import { isDraftLead } from "@/lib/lead-status";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { maskPhone, normalizeLeadPhoneDigits } from "@/lib/masks";
import { getHealthPlanLabel } from "@/lib/healthPlanLabels";
import { formatIntimezone } from "@/lib/dates"

const headerButtonClass = "h-8 max-lg:h-11 px-2 hover:bg-accent w-full justify-center";
const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Componente para o drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Button
        {...attributes}
        {...listeners}
        variant="ghost"
        size="icon"
        className="size-8 max-lg:size-11 p-0 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Arrastar para reordenar</span>
      </Button>
    </div>
  );
}

// Função para obter cor do badge baseado no status
function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    new_opportunity: "bg-blue-500",
    scheduled: "bg-purple-500",
    no_show: "bg-orange-500",
    pricingRequest: "bg-yellow-500",
    future_sale: "bg-fuchsia-500",
    offerNegotiation: "bg-amber-500",
    pending_documents: "bg-gray-500",
    offerSubmission: "bg-cyan-500",
    dps_agreement: "bg-indigo-500",
    invoicePayment: "bg-teal-500",
    disqualified: "bg-red-500",
    opportunityLost: "bg-rose-500",
    operator_denied: "bg-pink-500",
    contract_finalized: "bg-green-500",
  };
  
  return statusColors[status] || "bg-gray-500";
}

// Função para formatar data de reunião
function formatMeetingDate(dateString: string | null, tz: string): string {
  if (!dateString) return "-";
  
  try {
    const date = new Date(dateString);
    return formatIntimezone(date, "dd/MM/yyyy HH:mm", tz);
  } catch {
    return dateString;
  }
}

interface ColumnsProps {
  statusLabels: Record<string, string>;
  onRowClick: (lead: Lead) => void;
  onOpenContacts: (lead: Lead) => void;
  onScheduleMeeting: (lead: Lead) => void;
  onRescheduleMeeting: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => void;
  onFinalizeContract: (lead: Lead) => void;
  onChangeStatus: (lead: Lead) => void;
  tz: string;
}

export const createColumns = ({
  statusLabels,
  onRowClick,
  onOpenContacts,
  onScheduleMeeting,
  onRescheduleMeeting,
  onDeleteLead,
  onFinalizeContract,
  onChangeStatus,
  tz,
}: ColumnsProps): ColumnDef<Lead>[] => [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
    size: 40,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    meta: { label: "Nome" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Nome
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <div
          className="font-medium cursor-pointer hover:underline"
          onClick={() => onRowClick(row.original)}
        >
          {row.getValue("name")}
        </div>
      )
    },
  },
  {
    accessorKey: "leadCode",
    meta: { label: "ID" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          ID
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="text-sm">{row.getValue("leadCode") || "-"}</div>
    },
  },
  {
    accessorKey: "email",
    meta: { label: "Email" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 max-lg:h-11 px-2 hover:bg-accent"
        >
          Email
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div>{row.getValue("email") || "-"}</div>
    },
  },
  {
    accessorKey: "phone",
    meta: { label: "Telefone" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Telefone
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string
      if (!phone) return <div className="text-muted-foreground">-</div>

      const normalized = normalizeLeadPhoneDigits(phone)
      const waHref = normalized ? `https://wa.me/55${normalized}` : null

      return (
        <div className="flex items-center gap-1.5">
          <span
            className="cursor-pointer hover:underline"
            onClick={() => onRowClick(row.original)}
          >
            {maskPhone(phone)}
          </span>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex shrink-0 items-center justify-center max-lg:size-11 text-green-600 hover:text-green-700"
              aria-label="Abrir no WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      )
    },
  },
  {
    id: "contacts",
    accessorKey: "contactCount",
    meta: { label: "Contatos" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          <Phone className="mr-1 h-3.5 w-3.5" />
          Contatos
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const count = (row.original.contactCount ?? 0)
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onOpenContacts(row.original)
              }}
            >
              <Badge
                variant={count > 0 ? "secondary" : "outline"}
                className="min-w-[1.75rem] justify-center text-xs"
              >
                {count}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ver contatos</p>
          </TooltipContent>
        </Tooltip>
      )
    },
  },
  {
    accessorKey: "currentHealthPlan",
    meta: { label: "Plano atual" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Plano atual
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const plan = row.getValue("currentHealthPlan") as Lead["currentHealthPlan"]
      return <div className="text-sm">{getHealthPlanLabel(plan) || "-"}</div>
    },
  },
  {
    accessorKey: "currentValue",
    meta: { label: "Valor atual" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Valor atual
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const value = row.getValue("currentValue") as Lead["currentValue"]
      return <div className="text-sm">{formatCurrency(value)}</div>
    },
  },
  {
    accessorKey: "status",
    meta: { label: "Status" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Status
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const lead = row.original;
      if (isDraftLead(lead)) {
        return <DraftLeadIndicator />;
      }
      const status = row.getValue("status") as string;
      return (
        <Badge className={`${getStatusColor(status)} text-white`}>{statusLabels[status]}</Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "ticket",
    meta: { label: "Ticket" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Ticket
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const ticket = row.getValue("ticket") as Lead["ticket"]
      return <div className="text-sm">{formatCurrency(ticket)}</div>
    },
  },
  {
    accessorKey: "assignedTo",
    meta: { label: "Responsável" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Responsável
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const lead = row.original
      if (!lead.assignee) {
        return <span className="text-muted-foreground">-</span>
      }

      const assigneeLabel = lead.assignee.fullName || lead.assignee.email

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex cursor-default justify-center w-full">
              <Avatar className="size-6">
                <AvatarImage src={lead.assignee.avatarUrl || undefined} alt={assigneeLabel} />
                <AvatarFallback className="text-xs">
                  {assigneeLabel
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{assigneeLabel}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
    accessorFn: (row) => row.assignee?.fullName || row.assignee?.email || "",
    filterFn: (row, id, value) => {
      return value.includes(row.original.assignee?.id || "")
    },
  },
  {
    accessorKey: "closerId",
    meta: { label: "Closer" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Closer
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      const lead = row.original
      if (!lead.closer) {
        return <span className="text-muted-foreground">-</span>
      }

      const closerLabel = lead.closer.fullName || lead.closer.email

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex cursor-default justify-center w-full">
              <Avatar className="size-6">
                <AvatarImage src={lead.closer.avatarUrl || undefined} alt={closerLabel} />
                <AvatarFallback className="text-xs">
                  {closerLabel
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{closerLabel}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
    accessorFn: (row) => row.closer?.fullName || row.closer?.email || "",
    filterFn: (row, id, value) => {
      return value.includes(row.original.closer?.id || "")
    },
  },
  {
    accessorKey: "meetingDate",
    meta: { label: "Reunião" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Reunião
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="text-sm">{formatMeetingDate(row.getValue("meetingDate"), tz)}</div>
    },
  },
  {
    accessorKey: "createdAt",
    meta: { label: "Criado em" },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={headerButtonClass}
        >
          Criado em
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="text-sm">{formatDate(row.getValue("createdAt"), tz)}</div>
    },
    filterFn: (row, id, value) => {
      if (!value || !Array.isArray(value)) return true

      const rowDate = new Date(row.getValue(id) as string)
      const [startDate, endDate] = value

      if (startDate && endDate) {
        return rowDate >= startDate && rowDate <= endDate
      } else if (startDate) {
        return rowDate >= startDate
      }

      return true
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const lead = row.original

      // Verificar se pode agendar reunião (não tem reunião agendada e status permite)
      const canSchedule = !lead.meetingDate && lead.status !== "contract_finalized"

      // Verificar se pode reagendar (já tem reunião agendada)
      const canReschedule = !!lead.meetingDate && lead.status !== "contract_finalized"

      // Verificar se pode finalizar contrato
      const canFinalize =
        lead.status === "invoicePayment" ||
        lead.status === "dps_agreement" ||
        lead.status === "offerSubmission"

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="size-8 max-lg:size-11 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onChangeStatus(lead)
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Mudar status
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {canSchedule && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onScheduleMeeting(lead)
                }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Agendar reunião
              </DropdownMenuItem>
            )}

            {canReschedule && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onRescheduleMeeting(lead)
                }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Reagendar reunião
              </DropdownMenuItem>
            )}

            {canFinalize && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onFinalizeContract(lead)
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Fechar contrato
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDeleteLead(lead)
              }}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deletar lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
