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
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { Lead } from "../context/BoardTypes";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useTimezone } from "@/app/context/TimezoneContext";
import { Info, Loader2 } from "lucide-react";
import { formatLocalTimeValue } from "@/lib/dates";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";

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

export function TransferBetweenTeamsDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
  allowedTeamIds,
}: TransferBetweenTeamsDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { teams, activeTeamId } = useTeamContext();
  const { tz } = useTimezone();

  const [targetTeamId, setTargetTeamId] = useState("");
  const [closerId, setCloserId] = useState("");
  const [sdrId, setSdrId] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [allowedTargetTeamIds, setAllowedTargetTeamIds] = useState<string[]>([]);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const targetTeams = teams.filter((t) => t.id !== activeTeamId && allowedTargetTeamIds.includes(t.id));
  const closers = teamMembers.filter((m) => m.functions.includes("CLOSER"));
  const sdrs = teamMembers.filter((m) => m.functions.includes("SDR"));
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

  useEffect(() => {
    setTargetTeamId("");
    setCloserId("");
    setSdrId("");
    setTeamMembers([]);
    setAllowedTargetTeamIds([]);
    setScheduleEnabled(open && lead.isTransfer === true && !!lead.meetingDate);
    setMeetingDate(open && lead.isTransfer && lead.meetingDate ? new Date(lead.meetingDate) : undefined);
    setMeetingTitle(open && lead.isTransfer ? lead.meetingTitle ?? "" : "");
    setMeetingLink("");
    setAvailableTimes([]);
    setAvailabilityLoading(false);
  }, [open, lead]);

  useEffect(() => {
    if (allowedTeamIds) {
      setAllowedTargetTeamIds(allowedTeamIds);
      return;
    }
    if (!open || !activeTeamId || !supabaseId) return;

    let active = true;
    fetch(`/api/v1/teams/${activeTeamId}/members`, {
      headers: { "x-supabase-user-id": supabaseId },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const ids = Array.isArray(data?.result?.transferTargets)
          ? data.result.transferTargets.map((item: { teamId: string }) => item.teamId)
          : [];
        setAllowedTargetTeamIds(ids);
      })
      .catch(() => {
        if (!active) return;
        setAllowedTargetTeamIds([]);
      });

    return () => {
      active = false;
    };
  }, [open, activeTeamId, supabaseId, allowedTeamIds]);

  useEffect(() => {
    if (!targetTeamId || !supabaseId) {
      setTeamMembers([]);
      setCloserId("");
      setSdrId("");
      return;
    }

    let active = true;
    setMembersLoading(true);
    setCloserId("");
    setSdrId("");

    fetch(`/api/v1/teams/${targetTeamId}/members`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId ?? "",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
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
      .catch(() => {
        if (!active) return;
        toast.error("Erro ao carregar membros do time destino");
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [targetTeamId, supabaseId, activeTeamId]);

  const meetingDateKey = meetingDate
    ? [
        meetingDate.getFullYear(),
        String(meetingDate.getMonth() + 1).padStart(2, "0"),
        String(meetingDate.getDate()).padStart(2, "0"),
      ].join("-")
    : null;

  useEffect(() => {
    if (!scheduleEnabled || !closerId || !meetingDateKey || !supabaseId) {
      setAvailableTimes([]);
      return;
    }

    let active = true;
    setAvailabilityLoading(true);
    setAvailableTimes([]);

    fetch("/api/v1/calendar/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": targetTeamId,
      },
      body: JSON.stringify({ closerId, date: meetingDateKey, excludeLeadId: lead.id }),
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
  }, [scheduleEnabled, closerId, meetingDateKey, supabaseId, targetTeamId, lead.id]);

  const canSubmit =
    !!targetTeamId &&
    !!closerId &&
    !submitting &&
    (!scheduleEnabled ||
      (!!meetingDate &&
        !availabilityLoading &&
        availableTimes.length > 0 &&
        (!requiresManualMeetingLink || meetingLinkValidation.isValid)));

  const handleSubmit = async () => {
    if (!canSubmit || !supabaseId) return;

    setSubmitting(true);
    try {
      let schedulePayload: Record<string, unknown> | null = null;
      if (scheduleEnabled && meetingDate) {
        const normalizedMeetingLink = meetingLinkValidation.isValid
          ? meetingLinkValidation.normalized
          : undefined;
        schedulePayload = {
          date: meetingDate.toISOString(),
          meetingTitle: meetingTitle || lead.meetingTitle || undefined,
          meetingNotes: lead.meetingNotes || undefined,
          meetingLink: requiresManualMeetingLink ? normalizedMeetingLink : undefined,
          meetingType: "online",
          transitionStatusToScheduled: true,
        };
      }

      const response = await fetch(`/api/v1/leads/${lead.id}/transfer-teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId ?? "",
        },
        body: JSON.stringify({
          targetTeamId,
          closerId,
          sdrId: sdrId && sdrId !== "_none" ? sdrId : null,
          schedule: schedulePayload,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        const message = Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages[0]
          : "Erro ao transferir lead";
        throw new Error(message);
      }

      const transferResult = result.result as { lead?: Lead; schedulePending?: boolean } | Lead | null;
      const updatedLead = transferResult && "lead" in transferResult ? transferResult.lead : (transferResult as Lead);
      const schedulePending =
        transferResult && typeof transferResult === "object" && "schedulePending" in transferResult
          ? transferResult.schedulePending === true
          : false;

      if (!updatedLead) {
        throw new Error("Resposta inválida ao transferir lead");
      }

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
      toast.error(error instanceof Error ? error.message : "Erro ao transferir lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-130">
        <DialogHeader>
          <DialogTitle>Transferir Lead Entre Times</DialogTitle>
          <DialogDescription>
            Selecione o time destino e atribua um closer. O agendamento é opcional — desative o toggle para transferir sem reunião.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 flex flex-col gap-5 py-2 pr-1">
          <div className="flex flex-col gap-3">
            <Label htmlFor="targetTeam">Time destino</Label>
            <Select value={targetTeamId} onValueChange={setTargetTeamId}>
              <SelectTrigger id="targetTeam">
                <SelectValue placeholder="Selecione o time" />
              </SelectTrigger>
              <SelectContent>
                {targetTeams.length === 0 ? (
                  <SelectItem value="_none" disabled>Nenhum outro time disponível</SelectItem>
                ) : (
                  targetTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="closer">
              Closer <span className="text-destructive">*</span>
            </Label>
            <Select value={closerId} onValueChange={setCloserId} disabled={!targetTeamId || membersLoading}>
              <SelectTrigger id="closer">
                <SelectValue placeholder={membersLoading ? "Carregando..." : "Selecione o closer"} />
              </SelectTrigger>
              <SelectContent>
                {closers.length === 0 ? (
                  <SelectItem value="_none" disabled>Nenhum closer neste time</SelectItem>
                ) : (
                  closers.map((m) => (
                    <SelectItem key={m.id} value={m.profileId}>{m.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="sdr">SDR responsável</Label>
            <Select value={sdrId} onValueChange={setSdrId} disabled={!targetTeamId || membersLoading}>
              <SelectTrigger id="sdr">
                <SelectValue placeholder="Sem SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem SDR</SelectItem>
                {sdrs.map((m) => (
                  <SelectItem key={m.id} value={m.profileId}>{m.name}</SelectItem>
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
              Este closer não possui Google Calendar conectado. Informe o link da reunião para enviar os convites.
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
                  <p className="text-xs text-muted-foreground">Selecione um closer para carregar os horários disponíveis.</p>
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
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Ex: Apresentação de proposta"
                />
              </div>

              {requiresManualMeetingLink && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meetingLink">Link da reunião (obrigatório para este closer)</Label>
                  <Input
                    id="meetingLink"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
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
                  O lead e os convidados receberão o convite do Meet. O closer receberá o e-mail do Corretor Studio.
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
