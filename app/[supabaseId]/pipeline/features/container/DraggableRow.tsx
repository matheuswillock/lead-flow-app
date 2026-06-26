'use client';

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableCell, TableRow } from "@/components/ui/table";
import { flexRender, Row } from "@tanstack/react-table";
import { Lead } from "../context/PipelineTypes";
import { cn } from "@/lib/utils";
import { isDraftLead } from "@/lib/lead-status";
import { isMeetingFollowUpOverdue } from "@/lib/lead-meeting";

interface DraggableRowProps {
  row: Row<Lead>;
  onRowClick: (lead: Lead) => void;
}

export function DraggableRow({ row, onRowClick }: DraggableRowProps) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.original.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 1 : 0,
  };

  const isFollowUpOverdue = isMeetingFollowUpOverdue({
    status: row.original.status,
    meetingDate: row.original.meetingDate,
    meetingHeald: row.original.meetingHeald,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && "selected"}
      className={cn(
        "cursor-pointer",
        isDraftLead(row.original) && "bg-muted/40 border-l-2 border-dashed border-muted-foreground/40",
        (row.original.isLeadTimeBreached || isFollowUpOverdue) && "animate-pulse bg-destructive/10"
      )}
      data-draft={isDraftLead(row.original) ? "true" : "false"}
      onClick={() => onRowClick(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="p-2 text-center align-middle">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}
