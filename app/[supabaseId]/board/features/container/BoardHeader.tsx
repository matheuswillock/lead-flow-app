import { ReactNode, useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, Plus, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import useBoardContext from "../context/BoardHook";
import type { LeadCardField } from "../context/BoardContext";
import LeadImportButton from "@/app/[supabaseId]/components/LeadImportButton";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsSingleFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsSingleFilter";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsFilterPresetsSheet } from "@/app/[supabaseId]/components/leads-filters/LeadsFilterPresetsSheet";
import { LeadsCustomFieldFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsCustomFieldFilter";
import { LEAD_ORIGIN_FILTER_OPTIONS, parseLeadOriginFilter } from "@/lib/leads/origin-filter";
import { Separator } from "@/components/ui/separator";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";
import { isManagerLikeRole } from "@/lib/roles";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import { useActiveLeadCustomFieldDefinitions } from "@/hooks/useActiveLeadCustomFieldDefinitions";
import {
  areBoardFiltersEqual,
  boardPresetDescriptionLabel,
  normalizeBoardPresetFilters,
  type BoardFiltersState,
} from "../utils/boardPresetFilters";

const LEAD_CARD_OPTIONS: { key: LeadCardField; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "entryDate", label: "Data de Entrada" },
  { key: "meetingInfo", label: "Infos de agendamento" },
  { key: "notes", label: "Observações" },
  { key: "id", label: "Id" },
];

interface BoardHeaderProps {
  title?: string;
  viewModeToggle?: ReactNode;
  hideFiltersBar?: boolean;
}

export default function BoardHeader({
  title = "Kanban de Leads",
  viewModeToggle,
  hideFiltersBar = false,
}: BoardHeaderProps) {
  const {
    query,
    setQuery,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    assignedUsers,
    setAssignedUsers,
    statusFilter,
    setStatusFilter,
    closerFilter,
    setCloserFilter,
    customFieldFilters,
    setCustomFieldFilters,
    customFieldSort,
    setCustomFieldSort,
    onlyMeetingsHeld,
    setOnlyMeetingsHeld,
    onlyTransfer,
    setOnlyTransfer,
    originFilter,
    setOriginFilter,
    statusLabels,
    data,
    isLoading,
    openNewLeadDialog,
    refreshLeads,
    leadCardDisplay,
    setLeadCardDisplay,
  } = useBoardContext();
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId, activeRole } = useTeamContext();
  const { user } = useUser();
  const isManager = isManagerLikeRole(activeRole ?? undefined);
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);
  // Quando hideFiltersBar é true (CRM Kanban embute o board sem sua própria
  // barra — CrmFiltersBar já busca as definições), evita duplicar o fetch.
  const { definitions: customFieldDefinitions } = useActiveLeadCustomFieldDefinitions(
    hideFiltersBar ? undefined : supabaseId,
    hideFiltersBar ? undefined : activeTeamId
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [presets, setPresets] = useState<BoardFiltersState[]>([]);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `board:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of [...sdrMembers, ...closerMembers]) {
      map.set(member.id, member.name || member.email);
    }
    return map;
  }, [closerMembers, sdrMembers]);

  const currentBoardFilters = useMemo<BoardFiltersState>(
    () => ({
      query,
      assignedUsers,
      statusFilter,
      closerFilter,
      onlyMeetingsHeld,
      onlyTransfer,
      originFilter,
      periodStart,
      periodEnd,
      customFieldFilters,
      customFieldSort,
    }),
    [
      assignedUsers,
      closerFilter,
      customFieldFilters,
      customFieldSort,
      onlyMeetingsHeld,
      onlyTransfer,
      originFilter,
      periodEnd,
      periodStart,
      query,
      statusFilter,
    ]
  );

  const isPresetInUse = useMemo(
    () =>
      presets.some((preset) => areBoardFiltersEqual(preset, currentBoardFilters)),
    [currentBoardFilters, presets]
  );

  const applyBoardFilters = (filters: BoardFiltersState) => {
    setQuery(filters.query);
    setAssignedUsers(filters.assignedUsers);
    setStatusFilter(filters.statusFilter);
    setCloserFilter(filters.closerFilter);
    setOnlyMeetingsHeld(filters.onlyMeetingsHeld);
    setOriginFilter(filters.originFilter);
    setOnlyTransfer(filters.originFilter === "transfer" || filters.onlyTransfer);
    setPeriodStart(filters.periodStart);
    setPeriodEnd(filters.periodEnd);
    setCustomFieldFilters(filters.customFieldFilters);
    setCustomFieldSort(filters.customFieldSort);
    if (!filters.periodStart) {
      setDateRange(undefined);
      return;
    }
    const from = new Date(filters.periodStart);
    const to = filters.periodEnd ? new Date(filters.periodEnd) : undefined;
    setDateRange({ from, to });
  };

  const handlePresetsChange = useCallback(
    (items: { queryJson: BoardFiltersState }[]) => {
      setPresets(items.map((preset) => preset.queryJson));
    },
    []
  );

  const totalLeads = Object.values(data).flat().length;

  const statusOptions = useMemo(
    () =>
      Object.entries(statusLabels).map(([value, label]) => ({
        value,
        label,
      })),
    [statusLabels]
  );

  const responsibleOptions = useMemo(
    () =>
      sdrMembers.map((sdr) => ({
        value: sdr.id,
        label: sdr.name || sdr.email,
      })),
    [sdrMembers]
  );

  const closerOptions = useMemo(() => {
    return closerMembers.map((closer) => ({
      value: closer.id,
      label: closer.name || closer.email,
    }));
  }, [closerMembers]);

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (!range?.from) {
      setPeriodStart("");
      setPeriodEnd("");
      return;
    }
    setPeriodStart(format(range.from, "yyyy-MM-dd"));
    setPeriodEnd(range.to ? format(range.to, "yyyy-MM-dd") : "");
  };

  const isFiltered =
    query.trim().length > 0 ||
    assignedUsers.length > 0 ||
    statusFilter.length > 0 ||
    closerFilter.length > 0 ||
    onlyMeetingsHeld ||
    Boolean(originFilter) ||
    onlyTransfer ||
    Boolean(periodStart) ||
    Boolean(periodEnd) ||
    customFieldFilters.length > 0 ||
    Boolean(customFieldSort);

  const clearFilters = () => {
    setQuery("");
    setAssignedUsers([]);
    setStatusFilter([]);
    setCloserFilter([]);
    setOnlyMeetingsHeld(false);
    setOriginFilter("");
    setOnlyTransfer(false);
    setPeriodStart("");
    setPeriodEnd("");
    setDateRange(undefined);
    setCustomFieldFilters([]);
    setCustomFieldSort(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScrollText className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <p className="text-sm text-muted-foreground">{totalLeads} leads</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewModeToggle}
          <Button onClick={openNewLeadDialog} size="default" className="cursor-pointer">
            <Plus className="mr-2 size-4" />
            Adicionar novo lead
          </Button>
          <LeadImportButton onImportComplete={refreshLeads} />
          <Sheet>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Configuração dos cards"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Configuração dos cards</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <SheetContent side="right" className="w-105 sm:w-115">
              <SheetHeader>
                <SheetTitle>Configuração dos cards</SheetTitle>
                <SheetDescription>
                  Selecione quais informações aparecem no card do lead.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-3">
                {LEAD_CARD_OPTIONS.map((option) => {
                  const checkboxId = `lead-card-display-${option.key}`;
                  return (
                    <div
                      key={option.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={checkboxId}
                          checked={leadCardDisplay[option.key]}
                          onCheckedChange={(value) => {
                            const nextChecked = value === true;
                            setLeadCardDisplay((prev) => ({
                              ...prev,
                              [option.key]: nextChecked,
                            }));
                          }}
                        />
                        <Label htmlFor={checkboxId} className="text-sm font-medium leading-none">
                          {option.label}
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Isso afeta apenas os cards do board.
              </p>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {!hideFiltersBar && (
        <LeadsFiltersLayout>
          <Input
            placeholder="Filtrar por nome..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-37.5 lg:w-62.5"
          />
          <LeadsStatusFilter
            statusOptions={statusOptions}
            selectedStatuses={statusFilter}
            onChangeStatuses={(values) => setStatusFilter(values as typeof statusFilter)}
            meetingHeld={onlyMeetingsHeld}
            onToggleMeetingHeld={setOnlyMeetingsHeld}
          />
          <LeadsSingleFilter
            title="Origem"
            options={[...LEAD_ORIGIN_FILTER_OPTIONS]}
            value={originFilter}
            onChange={(value) => setOriginFilter(parseLeadOriginFilter(value))}
          />
          {responsibleOptions.length > 0 && (
            <LeadsMultiFilter
              title="Responsável"
              options={responsibleOptions}
              selectedValues={assignedUsers}
              onChange={setAssignedUsers}
            />
          )}
          {closerOptions.length > 0 && (
            <LeadsMultiFilter
              title="Closer"
              options={closerOptions}
              selectedValues={closerFilter}
              onChange={setCloserFilter}
            />
          )}
          <LeadsDateFilter
            title="Data de Criação"
            value={dateRange}
            onChange={handleDateChange}
          />
          <Separator orientation="vertical" className="h-6" />
          <LeadsCustomFieldFilter
            definitions={customFieldDefinitions}
            values={customFieldFilters}
            onChange={setCustomFieldFilters}
            sort={customFieldSort}
            onSortChange={setCustomFieldSort}
          />
          <LeadsFilterPresetsSheet
            scope="board"
            supabaseId={supabaseId}
            profileId={user?.id}
            teamId={activeTeamId}
            isManager={isManager}
            currentFilters={currentBoardFilters}
            isPresetActive={isPresetInUse}
            lastPresetStorageKey={lastPresetStorageKey}
            normalizePresetFilters={normalizeBoardPresetFilters}
            areFiltersEqual={areBoardFiltersEqual}
            presetDescriptionLabel={boardPresetDescriptionLabel}
            onApplyFilters={applyBoardFilters}
            getCreatorName={(id) => memberNameById.get(id)}
            onPresetsChange={handlePresetsChange}
          />
          {isFiltered && (
            <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </LeadsFiltersLayout>
      )}
    </div>
  );
}
