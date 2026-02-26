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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import { Lead } from "../context/BoardTypes";
import { useParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X } from "lucide-react";
import { useTeamContext } from "@/app/context/TeamContext";

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduleSuccess: () => void;
  closers: UserAssociated[];
  teamMembers?: UserAssociated[];
  mode?: "create" | "reschedule";
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  lead,
  onScheduleSuccess,
  closers,
  teamMembers,
  mode = "create",
}: ScheduleMeetingDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const [meetingDate, setMeetingDate] = useState<Date>();
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [meetingLink, setMeetingLink] = useState<string>("");
  const [closerId, setCloserId] = useState<string>("");
  const [extraGuests, setExtraGuests] = useState<string[]>([]);
  const [extraGuestsDraft, setExtraGuestsDraft] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [teamMembersFromApi, setTeamMembersFromApi] = useState<UserAssociated[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const fallbackMembers = teamMembers && teamMembers.length > 0 ? teamMembers : closers;
  const members = teamMembersFromApi.length > 0 ? teamMembersFromApi : fallbackMembers;
  const closersFromMembers = members.filter((member) => member.functions?.includes("CLOSER"));
  const fallbackClosers = closers.filter(
    (member) => member.functions?.includes("CLOSER") || !member.functions || member.functions.length === 0
  );
  const availableClosers =
    teamMembersFromApi.length > 0
      ? closersFromMembers
      : closersFromMembers.length > 0
        ? closersFromMembers
        : fallbackClosers;
  const isValidDate = (value?: Date): value is Date =>
    value instanceof Date && !Number.isNaN(value.getTime());
  const canSubmit =
    isValidDate(meetingDate) &&
    meetingTitle.trim().length > 0 &&
    !!closerId &&
    availableTimes.length > 0;
  const hasAvailabilityInputs = isValidDate(meetingDate) && !!closerId && !!supabaseId;

  useEffect(() => {
    if (!open || !activeTeamId || !supabaseId) {
      setTeamMembersFromApi([]);
      return;
    }

    let isMounted = true;

    const fetchTeamMembers = async () => {
      setTeamMembersLoading(true);
      try {
        const response = await fetch(`/api/v1/teams/${activeTeamId}/members`, {
          headers: {
            "x-supabase-user-id": supabaseId,
          },
        });
        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(
            Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
              ? result.errorMessages.join(", ")
              : "Erro ao carregar membros do time"
          );
        }

        const membersFromResult: UserAssociated[] = (result?.result?.members ?? []).map((member: any) => ({
          id: member.profileId,
          name: member.name || member.email || "Usuário",
          avatarImageUrl: member.profileIconUrl || "",
          email: member.email || "",
          role: member.role,
          functions: member.functions ?? [],
        }));

        if (isMounted) {
          setTeamMembersFromApi(membersFromResult);
        }
      } catch (error) {
        console.error("Erro ao carregar membros do time para agendamento:", error);
        if (isMounted) {
          setTeamMembersFromApi([]);
        }
      } finally {
        if (isMounted) {
          setTeamMembersLoading(false);
        }
      }
    };

    fetchTeamMembers();

    return () => {
      isMounted = false;
    };
  }, [open, activeTeamId, supabaseId]);

  useEffect(() => {
    if (!open) return;
    const parsedMeetingDate = lead.meetingDate ? new Date(lead.meetingDate) : undefined;
    const defaultMeetingTitle = `Estudo Plano de Saúde: ${lead.name}`;
    const hasExistingMeetingTitle = !!lead.meetingTitle?.trim();
    const shouldKeepExistingTitle = mode === "reschedule";
    setMeetingDate(isValidDate(parsedMeetingDate) ? parsedMeetingDate : undefined);
    setMeetingTitle(
      shouldKeepExistingTitle && hasExistingMeetingTitle
        ? lead.meetingTitle!
        : defaultMeetingTitle
    );
    setNotes(lead.meetingNotes || "");
    setMeetingLink(lead.meetingLink || "");
    setCloserId(lead.closerId || "");
    setExtraGuests([]);
    setExtraGuestsDraft("");
  }, [open, lead, mode]);

  useEffect(() => {
    if (!open || closerId) return;
    if (availableClosers.length === 1) {
      setCloserId(availableClosers[0].id);
    }
  }, [open, closerId, availableClosers]);

  const toDateKey = (date: Date) => {
    if (!isValidDate(date)) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!open || !isValidDate(meetingDate) || !closerId || !supabaseId) {
      setAvailableTimes([]);
      setAvailabilityError(null);
      return;
    }

    const currentMeetingDate = meetingDate;
    const dateKey = toDateKey(currentMeetingDate);
    if (!dateKey) {
      setAvailableTimes([]);
      setAvailabilityError("Data da reunião inválida. Selecione novamente.");
      return;
    }
    let isMounted = true;

    const fetchAvailability = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      try {
        const response = await fetch("/api/v1/calendar/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify({ closerId, date: dateKey }),
        });

        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Erro ao buscar disponibilidade.");
        }

        const times = result?.result?.availableTimes ?? [];
        if (!isMounted) return;
        setAvailableTimes(times);

        const currentTime = formatTime(currentMeetingDate);
        if (times.length > 0 && !times.includes(currentTime)) {
          const [hours, minutes] = times[0].split(":").map(Number);
          const nextDate = new Date(currentMeetingDate);
          nextDate.setHours(hours, minutes, 0, 0);
          setMeetingDate(isValidDate(nextDate) ? nextDate : undefined);
        }
      } catch (error) {
        if (!isMounted) return;
        setAvailableTimes([]);
        setAvailabilityError(
          error instanceof Error ? error.message : "Erro ao buscar disponibilidade."
        );
      } finally {
        if (isMounted) {
          setAvailabilityLoading(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      isMounted = false;
    };
  }, [open, meetingDate, closerId, supabaseId, activeTeamId]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const addExtraGuests = (values: string[]) => {
    const normalized = values
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter(isValidEmail);
    if (normalized.length === 0) return;
    setExtraGuests((prev) => Array.from(new Set([...prev, ...normalized])));
  };

  const handleExtraGuestsInput = (value: string) => {
    if (!value) {
      setExtraGuestsDraft("");
      return;
    }
    const parts = value.split(/[,;\s]+/);
    if (parts.length === 1) {
      setExtraGuestsDraft(value);
      return;
    }
    const last = value.match(/[,\s;]$/) ? "" : parts.pop() || "";
    addExtraGuests(parts);
    setExtraGuestsDraft(last);
  };

  const commitExtraGuestDraft = () => {
    if (!extraGuestsDraft.trim()) return;
    handleExtraGuestsInput(`${extraGuestsDraft} `);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidDate(meetingDate)) {
      toast.error("Selecione uma data e hora para o agendamento");
      return;
    }
    const scheduledMeetingDate = meetingDate;
    if (!meetingTitle.trim()) {
      toast.error("Informe o titulo da reunião");
      return;
    }
    if (!closerId) {
      toast.error("Selecione um closer para a reuniao");
      return;
    }

    const guests = extraGuests;

    setIsSubmitting(true);
    const loadingToast = toast.loading("Agendando reunião...");

    try {
      // 1. Criar agendamento
      const response = await fetch(`/api/v1/leads/${lead.id}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({
          date: scheduledMeetingDate.toISOString(),
          meetingTitle: meetingTitle.trim(),
          notes: notes || `Reunião agendada com ${lead.name}`,
          meetingLink: meetingLink || undefined,
          closerId: closerId || undefined,
          extraGuests: guests.length ? guests : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.isValid) {
        throw new Error(result.errorMessages?.join(", ") || "Erro ao agendar reunião");
      }

      const warningMessage = Array.isArray(result?.successMessages)
        ? result.successMessages.find((message: string) => message.toLowerCase().startsWith("aviso"))
        : undefined;

      // 2. Atualizar status do lead para scheduled
      const statusResponse = await fetch(`/api/v1/leads/${lead.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({
          status: "scheduled",
        }),
      });

      if (!statusResponse.ok) {
        console.warn("Erro ao atualizar status do lead");
      }

      // ✅ Sucesso - Fechar dialog e atualizar UI
      toast.success(`Reunião agendada para ${scheduledMeetingDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`, {
        id: loadingToast,
        duration: 4000,
      });

      if (warningMessage) {
        toast.info(warningMessage, { duration: 5000 });
      }
      
      // Limpar form
      setMeetingDate(undefined);
      setMeetingTitle("");
      setNotes("");
      setMeetingLink("");
      setExtraGuests([]);
      setExtraGuestsDraft("");
      
      // Fechar dialog
      onOpenChange(false);
      
      // 3. Atualizar board (recarregar leads)
      onScheduleSuccess();
      
    } catch (error) {
      console.error("Erro ao agendar reunião:", error);
      
      // ❌ Erro - Mostrar mensagem de erro
      toast.error(error instanceof Error ? error.message : "Erro ao agendar reunião", {
        id: loadingToast,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agendar Reunião</DialogTitle>
          <DialogDescription>
            Agendar reunião com <strong>{lead.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
            {/* Data e Hora */}
            <DateTimePicker
              date={meetingDate}
              onDateChange={setMeetingDate}
              label="Data e Horário da Reunião"
              required
              disablePastDates
              availableTimes={availableTimes}
            />
            {!isValidDate(meetingDate) && (
              <p className="text-xs text-muted-foreground">Selecione uma data para carregar horários disponíveis.</p>
            )}
            {isValidDate(meetingDate) && !closerId && (
              <p className="text-xs text-muted-foreground">Selecione um closer para carregar horários disponíveis.</p>
            )}
            {availabilityLoading && (
              <p className="text-xs text-muted-foreground">Carregando horários disponíveis...</p>
            )}
            {availabilityError && (
              <p className="text-xs text-destructive">{availabilityError}</p>
            )}
            {hasAvailabilityInputs && availableTimes.length === 0 && !availabilityLoading && !availabilityError && (
              <p className="text-xs text-muted-foreground">Nenhum horário disponível para este dia.</p>
            )}

            {/* Titulo da reuniao */}
            <div className="grid gap-2">
              <Label htmlFor="meetingTitle">Titulo da reuniao</Label>
              <Input
                id="meetingTitle"
                placeholder="Ex: Apresentação da proposta"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                required
              />
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações sobre a reunião..."
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Link da reunião */}
            <div className="grid gap-2">
              <Label htmlFor="meetingLink">Link da reunião (opcional)</Label>
              <Input
                id="meetingLink"
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
              />
            </div>

            {/* Convidados extras */}
            <div className="grid gap-2">
              <Label htmlFor="extraGuests">Convidados extras (emails)</Label>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
                {extraGuests.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                      onClick={() =>
                        setExtraGuests((prev) => prev.filter((item) => item !== email))
                      }
                      aria-label={`Remover ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="extraGuests"
                  type="text"
                  value={extraGuestsDraft}
                  onChange={(e) => handleExtraGuestsInput(e.target.value)}
                  onBlur={commitExtraGuestDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExtraGuestDraft();
                    }
                  }}
                  placeholder="ex: convidado1@email.com, convidado2@email.com"
                  className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Adicionar membros do time:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Selecionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60">
                    {members
                      .filter((member) => member.email)
                      .map((member) => {
                        const email = member.email!;
                        const checked = extraGuests.includes(email.toLowerCase());
                        return (
                          <DropdownMenuCheckboxItem
                            key={member.id}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked) {
                                addExtraGuests([email]);
                              } else {
                                setExtraGuests((prev) =>
                                  prev.filter((item) => item !== email.toLowerCase())
                                );
                              }
                            }}
                          >
                            {member.name}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-xs text-muted-foreground">
                Separe os emails por virgula ou espaco.
              </p>
            </div>

            {/* Closer */}
            <div className="grid gap-2">
              <Label>Closer</Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger disabled={teamMembersLoading}>
                  <SelectValue
                    placeholder={
                      teamMembersLoading
                        ? "Carregando closers..."
                        : availableClosers.length
                          ? "Selecione um closer"
                          : "Sem closers disponiveis"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableClosers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!teamMembersLoading && !availableClosers.length && (
                <p className="text-xs text-muted-foreground">
                  Nenhum closer disponível para este time.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Agendando..." : "Agendar Reunião"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
