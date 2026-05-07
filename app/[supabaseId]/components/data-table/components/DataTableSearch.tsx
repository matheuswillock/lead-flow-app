"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Table } from "@tanstack/react-table";
import type { DataTableSearchConfig } from "../types";

interface DataTableSearchProps<TData> {
  table: Table<TData>;
  config: DataTableSearchConfig;
}

export function DataTableSearch<TData>({ table, config }: DataTableSearchProps<TData>) {
  const column = table.getColumn(config.columnId);
  if (!column) return null;

  return (
    <div className="relative">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={config.placeholder}
        value={(column.getFilterValue() as string) ?? ""}
        onChange={(event) => column.setFilterValue(event.target.value)}
        className="pl-8 max-w-sm"
      />
    </div>
  );
}

