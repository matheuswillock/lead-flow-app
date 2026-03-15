import { ReactNode, useMemo, useState } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, Plus, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import useBoardContext from "../context/BoardHook";
import type { LeadCardField } from "../context/BoardContext";
import LeadImportButton from "@/app/[supabaseId]/components/LeadImportButton";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";

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
    onlyMeetingsHeld,
    setOnlyMeetingsHeld,
    statusLabels,
    user,
    userLoading,
    data,
    isLoading,
    openNewLeadDialog,
    refreshLeads,
    leadCardDisplay,
    setLeadCardDisplay,
  } = useBoardContext();
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

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
    Boolean(periodStart) ||
    Boolean(periodEnd);

  const clearFilters = () => {
    setQuery("");
    setAssignedUsers([]);
    setStatusFilter([]);
    setCloserFilter([]);
    setOnlyMeetingsHeld(false);
    setPeriodStart("");
    setPeriodEnd("");
    setDateRange(undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScrollText className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {userLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : user ? (
              <p className="text-sm text-muted-foreground">
                {user.email} ({user.role}) •{" "}
                {isLoading ? "Carregando..." : `${totalLeads} leads`}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewModeToggle}
          <Button onClick={openNewLeadDialog} size="default" className="cursor-pointer">
            <Plus className="mr-2 size-4" />
            Adicionar novo lead
          </Button>
          <LeadImportButton onImportComplete={refreshLeads} />
          <Dialog>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Configuração dos cards"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Configuração dos cards</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Configuração dos cards</DialogTitle>
                <DialogDescription>
                  Selecione quais informações aparecem no card do lead.
                </DialogDescription>
              </DialogHeader>
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
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!hideFiltersBar && (
        <LeadsFiltersLayout>
          <Input
            placeholder="Filtrar por nome..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
          <LeadsStatusFilter
            statusOptions={statusOptions}
            selectedStatuses={statusFilter}
            onChangeStatuses={(values) => setStatusFilter(values as typeof statusFilter)}
            meetingHeld={onlyMeetingsHeld}
            onToggleMeetingHeld={setOnlyMeetingsHeld}
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
