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
import { MoreHorizontal, Calendar, Trash2, CheckCircle, GripVertical } from "lucide-react";
import { Lead } from "../context/PipelineTypes";
import { formatDate } from "../context/PipelineContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
        className="h-8 w-8 p-0 cursor-grab active:cursor-grabbing"
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
function formatMeetingDate(dateString: string | null): string {
  if (!dateString) return "-";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

interface ColumnsProps {
  statusLabels: Record<string, string>;
  onRowClick: (lead: Lead) => void;
  onScheduleMeeting: (lead: Lead) => void;
  onRescheduleMeeting: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => void;
  onFinalizeContract: (lead: Lead) => void;
}

export const createColumns = ({
  statusLabels,
  onRowClick,
  onScheduleMeeting,
  onRescheduleMeeting,
  onDeleteLead,
  onFinalizeContract,
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
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Nome
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div 
          className="font-medium cursor-pointer hover:underline"
          onClick={() => onRowClick(row.original)}
        >
          {row.getValue("name")}
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Email
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div>{row.getValue("email") || "-"}</div>;
    },
  },
  {
    accessorKey: "phone",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Telefone
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div>{row.getValue("phone") || "-"}</div>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Status
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge className={`${getStatusColor(status)} text-white`}>
          {statusLabels[status]}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "assignedTo",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Responsável
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      const lead = row.original;
      if (!lead.assignee) {
        return <span className="text-muted-foreground">-</span>;
      }
      
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage 
              src={lead.assignee.avatarUrl || undefined} 
              alt={lead.assignee.fullName || lead.assignee.email} 
            />
            <AvatarFallback className="text-xs">
              {(lead.assignee.fullName || lead.assignee.email)
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">
            {lead.assignee.fullName || lead.assignee.email}
          </span>
        </div>
      );
    },
    accessorFn: (row) => row.assignee?.fullName || row.assignee?.email || "",
    filterFn: (row, id, value) => {
      return value.includes(row.original.assignee?.id || "");
    },
  },
  {
    accessorKey: "meetingDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Reunião
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-sm">
          {formatMeetingDate(row.getValue("meetingDate"))}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 hover:bg-accent"
        >
          Criado em
          <span className="ml-2">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}
          </span>
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-sm">
          {formatDate(row.getValue("createdAt"))}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const lead = row.original;
      
      // Verificar se pode agendar reunião (não tem reunião agendada e status permite)
      const canSchedule = !lead.meetingDate && lead.status !== 'contract_finalized';
      
      // Verificar se pode reagendar (já tem reunião agendada)
      const canReschedule = !!lead.meetingDate && lead.status !== 'contract_finalized';
      
      // Verificar se pode finalizar contrato
      const canFinalize = (
        lead.status === 'invoicePayment' || 
        lead.status === 'dps_agreement' ||
        lead.status === 'offerSubmission'
      );

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            
            {canSchedule && (
              <DropdownMenuItem onClick={() => onScheduleMeeting(lead)}>
                <Calendar className="mr-2 h-4 w-4" />
                Agendar reunião
              </DropdownMenuItem>
            )}
            
            {canReschedule && (
              <DropdownMenuItem onClick={() => onRescheduleMeeting(lead)}>
                <Calendar className="mr-2 h-4 w-4" />
                Reagendar reunião
              </DropdownMenuItem>
            )}
            
            {canFinalize && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onFinalizeContract(lead)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Fechar contrato
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDeleteLead(lead)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deletar lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
