"use client";

import { useEffect, useState } from "react";
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

interface TeamMemberOption {
  id: string;
  name: string;
  email: string | null;
  functions: ("SDR" | "CLOSER")[];
}

interface TransferBetweenTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSuccess: (lead: Lead) => void;
}

export function TransferBetweenTeamsDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
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

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingType, setMeetingType] = useState<"online" | "call" | "whatsapp">("call");

  const [submitting, setSubmitting] = useState(false);

  const targetTeams = teams.filter((t) => t.id !== activeTeamId);
  const closers = teamMembers.filter((m) => m.functions.includes("CLOSER"));
  const sdrs = teamMembers.filter((m) => m.functions.includes("SDR"));

  useEffect(() => {
    if (!open) {
      setTargetTeamId("");
      setCloserId("");
      setSdrId("");
      setTeamMembers([]);
      setScheduleEnabled(false);
      setMeetingDate(undefined);
      setMeetingTitle("");
      setMeetingLink("");
      setMeetingType("call");
    }
  }, [open]);

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
        const members: TeamMemberOption[] = (data?.result ?? []).map((m: {
          id: string;
          fullName?: string | null;
          name?: string | null;
          email?: string | null;
          functions?: ("SDR" | "CLOSER")[];
        }) => ({
          id: m.id,
          name: m.fullName ?? m.name ?? "",
          email: m.email ?? null,
          functions: m.functions ?? [],
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

  const canSubmit = !!targetTeamId && !!closerId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !supabaseId) return;

    setSubmitting(true);
    try {
      let schedulePayload: Record<string, unknown> | null = null;
      if (scheduleEnabled && meetingDate) {
        schedulePayload = {
          date: meetingDate.toISOString(),
          meetingTitle: meetingTitle || undefined,
          meetingLink: meetingLink || undefined,
          meetingType,
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

      toast.success("Lead transferido com sucesso");
      onSuccess(result.result as Lead);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao transferir lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Transferir Lead Entre Times</DialogTitle>
          <DialogDescription>
            Selecione o time destino e atribua um closer. O SDR é opcional.
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
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="sdr">SDR responsável (opcional)</Label>
            <Select value={sdrId} onValueChange={setSdrId} disabled={!targetTeamId || membersLoading}>
              <SelectTrigger id="sdr">
                <SelectValue placeholder="Sem SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem SDR</SelectItem>
                {sdrs.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="scheduleToggle">Agendar no ato da transferência</Label>
            <Switch
              id="scheduleToggle"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>

          {scheduleEnabled && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Data e hora da reunião</Label>
                <DateTimePicker
                  date={meetingDate}
                  onDateChange={setMeetingDate}
                  tz={tz}
                />
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="meetingType">Tipo</Label>
                <Select value={meetingType} onValueChange={(v) => setMeetingType(v as "online" | "call" | "whatsapp")}>
                  <SelectTrigger id="meetingType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Reunião online</SelectItem>
                    <SelectItem value="call">Ligação</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {meetingType === "online" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meetingLink">Link da reunião</Label>
                  <Input
                    id="meetingLink"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              )}
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
