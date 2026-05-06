"use client";

export type DataTableSelectFilterOption = {
  value: string;
  label: string;
};

export type DataTableSearchConfig = {
  columnId: string;
  placeholder: string;
  icon?: "search";
};

export type DataTableSelectFilterConfig = {
  columnId: string;
  placeholder: string;
  options: DataTableSelectFilterOption[];
};

export type DataTableDateRangeFilterConfig = {
  columnId: string;
  title: string;
};

export type DataTableColumnsToggleConfig = {
  label: string;
};

export type DataTableToolbarConfig = {
  search?: DataTableSearchConfig;
  selectFilters?: DataTableSelectFilterConfig[];
  dateRangeFilter?: DataTableDateRangeFilterConfig;
  columnsToggle?: DataTableColumnsToggleConfig;
};

