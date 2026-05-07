"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { useTimezone } from "@/app/context/TimezoneContext";
import { endOfDayInTz, startOfDayInTz } from "@/lib/dates";
import type { DataTableDateRangeFilterConfig } from "../types";

interface DataTableDateRangeFilterProps<TData> {
  table: Table<TData>;
  config: DataTableDateRangeFilterConfig;
}

export function DataTableDateRangeFilter<TData>({ table, config }: DataTableDateRangeFilterProps<TData>) {
  const { tz } = useTimezone();
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);

  React.useEffect(() => {
    const column = table.getColumn(config.columnId);
    if (!column) return;

    if (!range?.from && !range?.to) {
      column.setFilterValue(undefined);
      return;
    }

    const startDate = range.from ? new Date(range.from) : undefined;
    const normalizedStartDate = startDate ? startOfDayInTz(startDate, tz) : undefined;

    const endReference = range.to ?? range.from;
    const endDate = endReference ? new Date(endReference) : undefined;
    const normalizedEndDate = endDate ? endOfDayInTz(endDate, tz) : undefined;

    column.setFilterValue([normalizedStartDate, normalizedEndDate]);
  }, [range, table, tz, config.columnId]);

  return <LeadsDateFilter title={config.title} value={range} onChange={setRange} />;
}

