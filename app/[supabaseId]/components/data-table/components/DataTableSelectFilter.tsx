"use client";

import type { Table } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DataTableSelectFilterConfig } from "../types";

interface DataTableSelectFilterProps<TData> {
  table: Table<TData>;
  config: DataTableSelectFilterConfig;
}

export function DataTableSelectFilter<TData>({ table, config }: DataTableSelectFilterProps<TData>) {
  const column = table.getColumn(config.columnId);
  if (!column) return null;

  const currentValue = (column.getFilterValue() as string) || "all";
  const hasAllOption = config.options.some((option) => option.value === "all");
  const options = hasAllOption
    ? config.options
    : [{ value: "all", label: "Todos" }, ...config.options];

  return (
    <Select
      value={currentValue || "all"}
      onValueChange={(value) => column.setFilterValue(value === "all" ? "" : value)}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={config.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
