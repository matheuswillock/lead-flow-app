'use client';

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableRow } from "@/components/ui/table";
import { flexRender, Row } from "@tanstack/react-table";
import { Lead } from "../context/PipelineTypes";

interface DraggableRowProps {
  row: Row<Lead>;
  onRowClick: (lead: Lead) => void;
}

export function DraggableRow({ row, onRowClick }: DraggableRowProps) {
  const {
    attributes,
    listeners,
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

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && "selected"}
      className="cursor-pointer"
      onClick={() => onRowClick(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="p-4">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </TableRow>
  );
}
