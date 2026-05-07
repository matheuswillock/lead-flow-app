"use client";

import type { Table } from "@tanstack/react-table";
import type { DataTableToolbarConfig } from "../types";
import { DataTableSearch } from "./DataTableSearch";
import { DataTableSelectFilter } from "./DataTableSelectFilter";
import { DataTableDateRangeFilter } from "./DataTableDateRangeFilter";
import { DataTableColumnToggle } from "./DataTableColumnToggle";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  config?: DataTableToolbarConfig;
}

export function DataTableToolbar<TData>({ table, config }: DataTableToolbarProps<TData>) {
  if (!config) return null;

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center space-x-2">
        {config.search ? <DataTableSearch table={table} config={config.search} /> : null}
        {(config.selectFilters || []).map((filter) => (
          <DataTableSelectFilter key={filter.columnId} table={table} config={filter} />
        ))}
        {config.dateRangeFilter ? (
          <DataTableDateRangeFilter table={table} config={config.dateRangeFilter} />
        ) : null}
      </div>
      {config.columnsToggle ? <DataTableColumnToggle table={table} config={config.columnsToggle} /> : null}
    </div>
  );
}

