"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { Lead } from "../context/BoardTypes";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useTimezone } from "@/app/context/TimezoneContext";
import { Check, ChevronsUpDown, Info, Loader2 } from "lucide-react";
import { formatLocalTimeValue } from "@/lib/dates";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import { useOperationalAccess } from "@/app/context/OperationalAccessContext";
import type { TransferTargetItem } from "@/lib/multiskill/transfer-target-types";
import { cn } from "@/lib/utils";
import { API_CLIENT_BASE } from "@/lib/route-map";

interface TeamMemberOption {
  id: string;
  profileId: string;
  name: string;
  email: string | null;
  functions: ("SDR" | "CLOSER")[];
  googleCalendarConnected: boolean;
}

interface TransferBetweenTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSuccess: (lead: Lead) => void;
  allowedTeamIds?: string[];
}

function getTransferTargetKey(target: TransferTargetItem): string {
  return `${target.mode}:${target.teamId}`;
}

function getTransferTargetLabel(target: TransferTargetItem): string {
  if (target.mode === "multiskill") {
    const masterLabel = target.masterName ?? target.masterEmail ?? "Conta";
    return `${target.teamName} — ${masterLabel}`;
  }
  return target.teamName;
}

function mapEmbeddedMembers(
  members: NonNullable<TransferTargetItem["closers"]> | undefined,
  fn: "CLOSER" | "SDR"
): TeamMemberOption[] {
  if (!members) return [];
  return members.map((member) => ({
    id: member.profileId,
    profileId: member.profileId,
    name: member.fullName ?? member.email,
    email: member.email,
    functions: [fn] as ("SDR" | "CLOSER")[],
    googleCalendarConnected: member.googleCalendarConnected ?? false,
  }));
}

export function TransferBetweenTeamsDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
  allowedTeamIds,
}: TransferBetweenTeamsDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { tz } = useTimezone();
  const { access: operationalAccess } = useOperationalAccess();
  const canExternalMultiskillUi = operationalAccess.multiskillExternalTransfer;

  const [targetTeamQuery, setTargetTeamQuery] = useState("");
  const [transferTargets, setTransferTargets] = useState<TransferTargetItem[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [teamComboOpen, setTeamComboOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TransferTargetItem | null>(null);

  const [closerId, setCloserId] = useState("");
  const [sdrId, setSdrId] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const isMultiskillDestination = selectedTarget?.mode === "multiskill";
  const targetTeamId = selectedTarget?.teamId ?? "";

  const closers = useMemo(() => {
    if (isMultiskillDestination) {
      return mapEmbeddedMembers(selectedTarget?.closers, "CLOSER");
    }
    return teamMembers.filter((member) => member.functions.includes("CLOSER"));
  }, [isMultiskillDestination, selectedTarget?.closers, teamMembers]);

  const sdrs = useMemo(() => {
    if (isMultiskillDestination) {
      return mapEmbeddedMembers(selectedTarget?.sdrs, "SDR");
    }
    return teamMembers.filter((member) => member.functions.includes("SDR"));
  }, [isMultiskillDestination, selectedTarget?.sdrs, teamMembers]);

  const selectedCloser = closers.find((member) => member.profileId === closerId) ?? null;
  const requiresManualMeetingLink = !!selectedCloser && !selectedCloser.googleCalendarConnected;

  const meetingLinkValidation = useMemo(
    () =>
      validateMeetingLinkValue(meetingLink, {
        required: scheduleEnabled && requiresManualMeetingLink,
      }),
    [meetingLink, requiresManualMeetingLink, scheduleEnabled]
  );

  const selectedMeetingTime =
    meetingDate && !Number.isNaN(meetingDate.getTime())
      ? formatLocalTimeValue(meetingDate, tz)
      : null;

  const pickerAvailableTimes =
    scheduleEnabled && selectedMeetingTime && (!closerId || availabilityLoading)
      ? [selectedMeetingTime]
      : availableTimes;

  const teamSearchPlaceholder = canExternalMultiskillUi
    ? "Buscar por time, conta ou closer..."
    : "Buscar por time ou closer...";

  useEffect(() => {
    setTargetTeamQuery("");
    setTransferTargets([]);
    setSelectedTarget(null);
    setTeamComboOpen(false);
    setCloserId("");
    setSdrId("");
    setTeamMembers([]);
    setScheduleEnabled(open && lead.isTransfer === true);
    setMeetingDate(open && lead.isTransfer && lead.meetingDate ? new Date(lead.meetingDate) : undefined);
    setMeetingTitle(open && lead.isTransfer ? lead.meetingTitle ?? "" : "");
    setMeetingLink("");
    setAvailableTimes([]);
    setAvailabilityLoading(false);
  }, [open, lead]);

  useEffect(() => {
    if (!open || !activeTeamId || !supabaseId) return;

    let active = true;
    const timeoutId = setTimeout(() => {
      setTargetsLoading(true);
      const params = new URLSearchParams();
      if (targetTeamQuery.trim()) params.set("q", targetTeamQuery.trim());
      params.set("page", "1");
      params.set("pageSize", "50");

      fetch(`${API_CLIENT_BASE}/teams/${activeTeamId}/transfer-targets?${params.toString()}`, {
        headers: { "x-supabase-user-id": supabaseId },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          if (!data?.isValid) {
            setTransferTargets([]);
            return;
          }
          let items: TransferTargetItem[] = Array.isArray(data?.result?.items)
            ? data.result.items
            : [];
          if (allowedTeamIds) {
            const allowed = new Set(allowedTeamIds);
            items = items.filter(
              (item) => item.mode === "multiskill" || allowed.has(item.teamId)
            );
          }
          setTransferTargets(items);
        })
        .catch(() => {
          if (!active) return;
          setTransferTargets([]);
        })
        .finally(() => {
          if (active) setTargetsLoading(false);
        });
    }, targetTeamQuery.trim() ? 300 : 0);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [open, activeTeamId, supabaseId, targetTeamQuery, allowedTeamIds]);

  useEffect(() => {
    if (!selectedTarget || isMultiskillDestination || !supabaseId) {
      if (!isMultiskillDestination) {
        setTeamMembers([]);
      }
      setMembersLoading(false);
      return;
    }

    let active = true;
    setMembersLoading(true);

    fetch(`${API_CLIENT_BASE}/teams/${selectedTarget.teamId}/members`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId ?? "",
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data?.isValid) {
          const message =
            Array.isArray(data?.errorMessages) && data.errorMessages.length > 0
              ? data.errorMessages[0]
              : "Erro ao carregar membros do time destino";
          throw new Error(message);
        }
        const members: TeamMemberOption[] = (data?.result?.members ?? []).map((m: {
          id: string;
          profileId?: string;
          fullName?: string | null;
          name?: string | null;
          email?: string | null;
          functions?: ("SDR" | "CLOSER")[];
          googleCalendarConnected?: boolean;
        }) => ({
          id: m.id,
          profileId: m.profileId ?? m.id,
          name: m.fullName ?? m.name ?? "",
          email: m.email ?? null,
          functions: m.functions ?? [],
          googleCalendarConnected: m.googleCalendarConnected ?? false,
        }));
        setTeamMembers(members);
      })
      .catch((error) => {
        if (!active) return;
        setTeamMembers([]);
        toastUserError(error);
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTarget, isMultiskillDestination, supabaseId, activeTeamId]);

  useEffect(() => {
    setCloserId("");
    setSdrId("");
  }, [selectedTarget]);

  const meetingDateKey = meetingDate
    ? [
        meetingDate.getFullYear(),
        String(meetingDate.getMonth() + 1).padStart(2, "0"),
        String(meetingDate.getDate()).padStart(2, "0"),
      ].join("-")
    : null;

  useEffect(() => {
    if (!scheduleEnabled || !closerId || !meetingDateKey || !supabaseId || !targetTeamId) {
      setAvailableTimes([]);
      return;
    }

    let active = true;
    setAvailabilityLoading(true);
    setAvailableTimes([]);

    const availabilityTeamHeader = isMultiskillDestination
      ? (activeTeamId ?? "")
      : targetTeamId;
    const body: Record<string, string> = {
      closerId,
      date: meetingDateKey,
      excludeLeadId: lead.id,
    };
    if (isMultiskillDestination) {
      body.destinationTeamId = targetTeamId;
    }

    fetch(`${API_CLIENT_BASE}/calendar/availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": availabilityTeamHeader,
      },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setAvailableTimes(data?.result?.availableTimes ?? []);
      })
      .catch(() => {
        if (!active) return;
        setAvailableTimes([]);
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    scheduleEnabled,
    closerId,
    meetingDateKey,
    supabaseId,
    targetTeamId,
    lead.id,
    isMultiskillDestination,
    activeTeamId,
  ]);

  const canSubmit =
    !!selectedTarget &&
    !!closerId &&
    !submitting &&
    (!scheduleEnabled ||
      (!!meetingDate &&
        !availabilityLoading &&
        availableTimes.length > 0 &&
        (!requiresManualMeetingLink || meetingLinkValidation.isValid)));

  const handleSelectTarget = (target: TransferTargetItem) => {
    setSelectedTarget(target);
    setTeamComboOpen(false);
    setTargetTeamQuery(getTransferTargetLabel(target));
  };

  const buildSchedulePayload = (): Record<string, unknown> | null => {
    if (!scheduleEnabled || !meetingDate) return null;
    const normalizedMeetingLink = meetingLinkValidation.isValid
      ? meetingLinkValidation.normalized
      : undefined;
    return {
      date: meetingDate.toISOString(),
      meetingTitle: meetingTitle || lead.meetingTitle || undefined,
      meetingNotes: lead.meetingNotes || undefined,
      meetingLink: requiresManualMeetingLink ? normalizedMeetingLink : undefined,
      meetingType: "online",
      transitionStatusToScheduled: true,
    };
  };

  const resolveTransferLeadResult = (
    result: { lead?: Lead; schedulePending?: boolean } | Lead | null
  ): { updatedLead: Lead; schedulePending: boolean } => {
    const updatedLead =
      result && typeof result === "object" && "lead" in result && result.lead
        ? result.lead
        : (result as Lead);
    const schedulePending =
      result && typeof result === "object" && "schedulePending" in result
        ? result.schedulePending === true
        : false;
    if (!updatedLead) {
      throw new Error("Resposta inválida ao transferir lead");
    }
    return { updatedLead, schedulePending };
  };

  const handleSubmit = async () => {
    if (!canSubmit || !supabaseId || !selectedTarget) return;

    setSubmitting(true);
    try {
      const schedulePayload = buildSchedulePayload();

      if (selectedTarget.mode === "multiskill") {
        if (!selectedTarget.masterId) {
          throw new Error("Destino MultiSkill inválido");
        }

        const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}/transfer-multiskill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId ?? "",
          },
          body: JSON.stringify({
            targetMasterId: selectedTarget.masterId,
            closerId,
            sdrId: sdrId && sdrId !== "_none" ? sdrId : null,
            schedule: schedulePayload,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          const message =
            Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
              ? result.errorMessages[0]
              : "Erro ao transferir lead via MultiSkill";
          throw new Error(message);
        }

        const { updatedLead, schedulePending } = resolveTransferLeadResult(
          result.result as { lead?: Lead; schedulePending?: boolean } | Lead | null
        );

        if (schedulePending) {
          toast.success("Lead transferido via MultiSkill. O agendamento está sendo processado.");
        } else {
          toast.success("Lead transferido via MultiSkill com sucesso");
        }
        onSuccess(updatedLead);
        onOpenChange(false);
        return;
      }

      const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}/transfer-teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId ?? "",
        },
        body: JSON.stringify({
          targetTeamId: selectedTarget.teamId,
          closerId,
          sdrId: sdrId && sdrId !== "_none" ? sdrId : null,
          schedule: schedulePayload,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        const message =
          Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
            ? result.errorMessages[0]
            : "Erro ao transferir lead";
        throw new Error(message);
      }

      const { updatedLead, schedulePending } = resolveTransferLeadResult(
        result.result as { lead?: Lead; schedulePending?: boolean } | Lead | null
      );

      if (schedulePending) {
        toast.success("Lead transferido. O agendamento está sendo processado.");
      } else if (Array.isArray(result.errorMessages) && result.errorMessages.length > 0) {
        toast.warning(result.errorMessages[0]);
      } else {
        toast.success("Lead transferido com sucesso");
      }
      onSuccess(updatedLead);
      onOpenChange(false);
    } catch (error) {
      toastUserError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-130">
        <DialogHeader>
          <DialogTitle>Transferir Lead</DialogTitle>
          <DialogDescription>
            Selecione o time destino e atribua um closer. O agendamento é opcional — desative o
            toggle para transferir sem reunião.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 flex flex-col gap-5 py-2 pr-1">
          <div className="flex flex-col gap-3">
            <Label htmlFor="targetTeamSearch">Time destino</Label>
            <Popover open={teamComboOpen} onOpenChange={setTeamComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="targetTeamSearch"
                  variant="outline"
                  role="combobox"
                  aria-expanded={teamComboOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedTarget ? getTransferTargetLabel(selectedTarget) : "Selecione o time"}
                  <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Input
                      value={targetTeamQuery}
                      onChange={(event) => {
                        setTargetTeamQuery(event.target.value);
                        if (selectedTarget && event.target.value !== getTransferTargetLabel(selectedTarget)) {
                          setSelectedTarget(null);
                        }
                      }}
                      placeholder={teamSearchPlaceholder}
                      className="h-10 border-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <CommandList>
                    {targetsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Carregando times...
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>Nenhum time encontrado.</CommandEmpty>
                        <CommandGroup>
                          {transferTargets.map((target) => {
                            const key = getTransferTargetKey(target);
                            const isSelected =
                              !!selectedTarget && getTransferTargetKey(selectedTarget) === key;
                            return (
                              <CommandItem
                                key={key}
                                value={key}
                                onSelect={() => handleSelectTarget(target)}
                              >
                                <Check
                                  className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")}
                                />
                                {getTransferTargetLabel(target)}
                                {target.mode === "multiskill" ? (
                                  <span className="ml-2 text-xs text-muted-foreground">MultiSkill</span>
                                ) : null}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedTarget?.mode === "multiskill" ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p>
                Transferência externa MultiSkill para{" "}
                <span className="font-medium">
                  {selectedTarget.masterName ?? selectedTarget.masterEmail}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                O lead será atribuído ao time padrão na conta destino.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <Label htmlFor="closer">
              Closer <span className="text-destructive">*</span>
            </Label>
            <Select
              value={closerId}
              onValueChange={setCloserId}
              disabled={!selectedTarget || (membersLoading && !isMultiskillDestination)}
            >
              <SelectTrigger id="closer">
                <SelectValue
                  placeholder={
                    membersLoading && !isMultiskillDestination
                      ? "Carregando..."
                      : "Selecione o closer"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {closers.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    Nenhum closer neste time
                  </SelectItem>
                ) : (
                  closers.map((member) => (
                    <SelectItem key={member.id} value={member.profileId}>
                      {member.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="sdr">SDR responsável</Label>
            <Select
              value={sdrId}
              onValueChange={setSdrId}
              disabled={!selectedTarget || (membersLoading && !isMultiskillDestination)}
            >
              <SelectTrigger id="sdr">
                <SelectValue placeholder="Sem SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem SDR</SelectItem>
                {sdrs.map((member) => (
                  <SelectItem key={member.id} value={member.profileId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="scheduleToggle">Agendar no ato da transferência</Label>
            <Switch
              id="scheduleToggle"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>

          {closerId && requiresManualMeetingLink && (
            <p className="text-xs text-muted-foreground">
              Este closer não possui Google Calendar conectado. Informe o link da reunião para
              enviar os convites.
            </p>
          )}

          {scheduleEnabled && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Data e hora da reunião</Label>
                <DateTimePicker
                  date={meetingDate}
                  onDateChange={setMeetingDate}
                  tz={tz}
                  label=""
                  availableTimes={pickerAvailableTimes}
                  timeLoading={availabilityLoading}
                  timeLoadingText="Carregando agenda do closer..."
                />
                {!closerId && meetingDate && (
                  <p className="text-xs text-muted-foreground">
                    Selecione um closer para carregar os horários disponíveis.
                  </p>
                )}
                {closerId && availabilityLoading && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Carregando horários disponíveis...
                  </p>
                )}
                {closerId && meetingDate && !availabilityLoading && availableTimes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {lead.isTransfer && lead.meetingDate
                      ? "O horário do pré-agendamento não está disponível para este closer. Para prosseguir, selecione outro closer, escolha outro horário ou desative o agendamento abaixo."
                      : "Nenhum horário disponível para este closer neste dia. Selecione outro closer ou outra data."}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="meetingTitle">Título da reunião</Label>
                <Input
                  id="meetingTitle"
                  value={meetingTitle}
                  onChange={(event) => setMeetingTitle(event.target.value)}
                  placeholder="Ex: Apresentação de proposta"
                />
              </div>

              {requiresManualMeetingLink && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meetingLink">
                    Link da reunião (obrigatório para este closer)
                  </Label>
                  <Input
                    id="meetingLink"
                    value={meetingLink}
                    onChange={(event) => setMeetingLink(event.target.value)}
                    placeholder="https://meet.google.com/..."
                  />
                  {meetingLink.trim() && !meetingLinkValidation.isValid && (
                    <p className="text-xs text-destructive">{meetingLinkValidation.error}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <Info className="size-4 shrink-0" />
                  <span>
                    {requiresManualMeetingLink
                      ? "Os convites serão enviados por e-mail com o link informado."
                      : "O link do Google Meet será gerado automaticamente após a transferência."}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  O lead e os convidados receberão o convite do Meet. O closer receberá o
                  e-mail do Corretor Studio.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
