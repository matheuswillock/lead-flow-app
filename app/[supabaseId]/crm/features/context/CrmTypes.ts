import type {
  CustomFieldFilterState,
  CustomFieldSortState,
} from "@/app/[supabaseId]/components/leads-filters/customFieldFilterTypes";
import {
  type LeadOriginFilterValue,
} from "@/lib/leads/origin-filter";

export type CrmViewMode = "pipeline" | "kanban";

export interface CrmFiltersState {
  query: string;
  statusFilter: string[];
  assignedUsers: string[];
  closerFilter: string[];
  periodStart: string;
  periodEnd: string;
  scheduledPeriodStart: string;
  scheduledPeriodEnd: string;
  onlyMeetingsHeld: boolean;
  onlyTransfer: boolean;
  originFilter: LeadOriginFilterValue | "";
  onlyDraft: boolean;
  customFieldFilters: CustomFieldFilterState[];
  customFieldSort: CustomFieldSortState | null;
}

export const DEFAULT_CRM_FILTERS: CrmFiltersState = {
  query: "",
  statusFilter: [],
  assignedUsers: [],
  closerFilter: [],
  periodStart: "",
  periodEnd: "",
  scheduledPeriodStart: "",
  scheduledPeriodEnd: "",
  onlyMeetingsHeld: false,
  onlyTransfer: false,
  originFilter: "",
  onlyDraft: false,
  customFieldFilters: [],
  customFieldSort: null,
};

export const isCrmFiltersEmpty = (filters: CrmFiltersState): boolean =>
  !filters.query.trim() &&
  filters.statusFilter.length === 0 &&
  filters.assignedUsers.length === 0 &&
  filters.closerFilter.length === 0 &&
  !filters.periodStart &&
  !filters.periodEnd &&
  !filters.scheduledPeriodStart &&
  !filters.scheduledPeriodEnd &&
  !filters.onlyMeetingsHeld &&
  !filters.onlyTransfer &&
  !filters.originFilter &&
  !filters.onlyDraft &&
  filters.customFieldFilters.length === 0 &&
  !filters.customFieldSort;

export const CRM_DEFAULT_VIEW_MODE: CrmViewMode = "pipeline";

export const isCrmViewMode = (
  value: string | null | undefined
): value is CrmViewMode => value === "pipeline" || value === "kanban";

export const normalizeCrmViewMode = (
  value: string | null | undefined
): CrmViewMode | null => {
  return isCrmViewMode(value) ? value : null;
};
