"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublicLeadFormContext } from "../context/PublicLeadFormContext";
import type { GuestCandidateOption } from "../services/IPublicLeadFormService";
import {
  formatLocalDateValue,
  formatLocalTimeValue,
  parseDateKeyAndTimeToUtc,
} from "@/lib/dates";

interface SchedulingSectionProps {
  leadName: string;
  closerId: string;
  onCloserIdChange: (value: string) => void;
  meetingDate: Date | undefined;
  onMeetingDateChange: (date: Date | undefined) => void;
  meetingTitle: string;
  onMeetingTitleChange: (value: string) => void;
  meetingNotes: string;
  onMeetingNotesChange: (value: string) => void;
  extraGuests: string;
  extraGuestsError?: string | null;
  onExtraGuestsChange: (value: string) => void;
  guestCandidates: GuestCandidateOption[];
  disabled?: boolean;
}

const isValidDate = (value?: Date): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const parseEmails = (value: string | undefined) => {
  if (!value) return [];
  return value
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const buildEmailValue = (emails: string[]) => {
  const unique = Array.from(new Set(emails));
  return unique.join(", ");
};

const fieldLabelClassName = "block text-sm font-medium mb-1";
const fieldInputClassName = "h-9";
const fieldSelectTriggerClassName = "h-9";
const fieldTextareaClassName = "min-h-[84px] resize-y";

export function SchedulingSection({
  leadName,
  closerId,
  onCloserIdChange,
  meetingDate,
  onMeetingDateChange,
  meetingTitle,
  onMeetingTitleChange,
  meetingNotes,
  onMeetingNotesChange,
  extraGuests,
  extraGuestsError,
  onExtraGuestsChange,
  guestCandidates,
  disabled = false,
}: SchedulingSectionProps) {
  const {
    closers,
    closersLoading,
    availableTimes,
    availabilityLoading,
    fetchAvailability,
    timezone,
  } = usePublicLeadFormContext();

  const [hasLoadedAvailability, setHasLoadedAvailability] = useState(false);
  const [extraGuestsDraft, setExtraGuestsDraft] = useState("");

  const selectedGuestEmails = useMemo(() => parseEmails(extraGuests), [extraGuests]);
  const schedulingReady =
    !!closerId && hasLoadedAvailability && !availabilityLoading && availableTimes.length > 0;

  useEffect(() => {
    if (!closerId && closers.length === 1) {
      onCloserIdChange(closers[0].id);
    }
  }, [closerId, closers, onCloserIdChange]);

  useEffect(() => {
    if (!meetingTitle && leadName.length >= 2) {
      onMeetingTitleChange(`Estudo Plano de Saúde: ${leadName}`);
    }
  }, [leadName, meetingTitle, onMeetingTitleChange]);

  useEffect(() => {
    if (!closerId || !isValidDate(meetingDate)) {
      setHasLoadedAvailability(false);
      return;
    }

    const dateKey = formatLocalDateValue(meetingDate, timezone);
    setHasLoadedAvailability(true);
    void fetchAvailability(closerId, dateKey);
  }, [closerId, meetingDate, fetchAvailability, timezone]);

  useEffect(() => {
    if (!isValidDate(meetingDate) || availableTimes.length === 0) return;

    const currentTime = formatLocalTimeValue(meetingDate, timezone);

    if (!availableTimes.includes(currentTime)) {
      const nextDate = parseDateKeyAndTimeToUtc(
        formatLocalDateValue(meetingDate, timezone),
        availableTimes[0],
        timezone
      );
      if (isValidDate(nextDate)) {
        onMeetingDateChange(nextDate);
      }
    }
  }, [availableTimes, meetingDate, onMeetingDateChange, timezone]);

  const handleGuestDraftChange = (
    value: string,
    currentEmails: string[],
    onChange: (value: string) => void
  ) => {
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
    const normalized = parts
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter((email) => isValidEmail(email));

    if (normalized.length > 0) {
      onChange(buildEmailValue([...currentEmails, ...normalized]));
    }

    setExtraGuestsDraft(last);
  };

  const commitGuestDraft = (
    currentEmails: string[],
    onChange: (value: string) => void
  ) => {
    if (!extraGuestsDraft.trim()) return;
    handleGuestDraftChange(`${extraGuestsDraft} `, currentEmails, onChange);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="closerId" className={fieldLabelClassName}>Closer</Label>
        {closersLoading ? (
          <p className="text-xs text-muted-foreground">Carregando closers...</p>
        ) : closers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum closer disponível</p>
        ) : (
          <Select value={closerId} onValueChange={onCloserIdChange} disabled={disabled}>
            <SelectTrigger id="closerId" className={fieldSelectTriggerClassName}>
              <SelectValue placeholder="Selecione um closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((closer) => (
                <SelectItem key={closer.id} value={closer.id}>
                  {closer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DateTimePicker
        date={meetingDate}
        onDateChange={onMeetingDateChange}
        label="Data e Horário"
        disabled={disabled || !closerId}
        disablePastDates
        availableTimes={availableTimes}
        timeLoading={availabilityLoading && !!closerId}
        timeLoadingText="Carregando agenda..."
        tz={timezone}
      />

      {!closerId && (
        <p className="text-xs text-muted-foreground">
          Selecione um closer para habilitar data e horário.
        </p>
      )}
      {!isValidDate(meetingDate) && closerId && (
        <p className="text-xs text-muted-foreground">Selecione uma data para carregar horários disponíveis.</p>
      )}
      {hasLoadedAvailability && availableTimes.length === 0 && !availabilityLoading && (
        <p className="text-xs text-muted-foreground">Nenhum horário disponível para este dia.</p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="meetingTitle" className={fieldLabelClassName}>Título da reunião</Label>
        <Input
          className={fieldInputClassName}
          id="meetingTitle"
          placeholder="Ex: Apresentação da proposta"
          value={meetingTitle}
          onChange={(e) => onMeetingTitleChange(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="meetingNotes" className={fieldLabelClassName}>Observações</Label>
        <Textarea
          className={fieldTextareaClassName}
          id="meetingNotes"
          placeholder="Adicione observações sobre a reunião..."
          value={meetingNotes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onMeetingNotesChange(e.target.value)}
          rows={3}
          disabled={disabled || !schedulingReady}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="extraGuestsInput" className={fieldLabelClassName}>Convidados extras (emails)</Label>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
            {selectedGuestEmails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1 pr-1">
                <span>{email}</span>
                <button
                  type="button"
                  className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                  onClick={() => {
                    const next = selectedGuestEmails.filter((item) => item !== email);
                    onExtraGuestsChange(buildEmailValue(next));
                  }}
                  aria-label={`Remover ${email}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              id="extraGuestsInput"
              type="text"
              value={extraGuestsDraft}
              onChange={(e) =>
                handleGuestDraftChange(
                  e.target.value,
                  selectedGuestEmails,
                  onExtraGuestsChange
                )
              }
              onBlur={() => commitGuestDraft(selectedGuestEmails, onExtraGuestsChange)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitGuestDraft(selectedGuestEmails, onExtraGuestsChange);
                }
              }}
              placeholder="ex: convidado1@email.com, convidado2@email.com"
              className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={disabled || !schedulingReady}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Adicionar membros do time:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={disabled || !schedulingReady}>
                  Selecionar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                {guestCandidates.map((candidate) => {
                  const email = candidate.email;
                  const checked = selectedGuestEmails.includes(email.toLowerCase());

                  return (
                    <DropdownMenuCheckboxItem
                      key={candidate.id}
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        const next = nextChecked
                          ? [...selectedGuestEmails, email]
                          : selectedGuestEmails.filter((item) => item !== email.toLowerCase());
                        onExtraGuestsChange(buildEmailValue(next));
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={candidate.avatarImageUrl || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {candidate.name
                              .split(" ")
                              .map((name) => name[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{candidate.name}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-xs text-muted-foreground">
            Separe os emails por vírgula ou espaço.
          </p>
          {extraGuestsError && (
            <p className="text-xs text-destructive">{extraGuestsError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
