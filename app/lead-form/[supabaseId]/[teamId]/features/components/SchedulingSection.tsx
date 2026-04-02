"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublicLeadFormContext } from "../context/PublicLeadFormContext";

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
}

const TIMEZONE = "America/Sao_Paulo";

const toDateKey = (date: Date) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const isValidDate = (value?: Date): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

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
}: SchedulingSectionProps) {
  const {
    closers,
    closersLoading,
    availableTimes,
    availabilityLoading,
    fetchAvailability,
  } = usePublicLeadFormContext();

  const [hasLoadedAvailability, setHasLoadedAvailability] = useState(false);

  // Auto-select closer if only one
  useEffect(() => {
    if (!closerId && closers.length === 1) {
      onCloserIdChange(closers[0].id);
    }
  }, [closerId, closers, onCloserIdChange]);

  // Auto-fill meeting title based on lead name
  useEffect(() => {
    if (!meetingTitle && leadName.length >= 2) {
      onMeetingTitleChange(`Estudo Plano de Saúde: ${leadName}`);
    }
  }, [leadName, meetingTitle, onMeetingTitleChange]);

  // Fetch availability when closer + date are selected
  useEffect(() => {
    if (!closerId || !isValidDate(meetingDate)) {
      setHasLoadedAvailability(false);
      return;
    }

    const dateKey = toDateKey(meetingDate);
    setHasLoadedAvailability(true);
    fetchAvailability(closerId, dateKey);
  }, [closerId, meetingDate, fetchAvailability]);

  // Adjust time to first available slot if current time is not available
  useEffect(() => {
    if (!isValidDate(meetingDate) || availableTimes.length === 0) return;

    const formatTime = (d: Date) =>
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const currentTime = formatTime(meetingDate);

    if (!availableTimes.includes(currentTime)) {
      const [hours, minutes] = availableTimes[0].split(":").map(Number);
      const nextDate = new Date(meetingDate);
      nextDate.setHours(hours, minutes, 0, 0);
      if (isValidDate(nextDate)) {
        onMeetingDateChange(nextDate);
      }
    }
  }, [availableTimes, meetingDate, onMeetingDateChange]);

  return (
    <div className="space-y-4">

      {/* Closer selection */}
      <div className="grid gap-2">
        <Label htmlFor="closerId" className={fieldLabelClassName}>Closer</Label>
        {closersLoading ? (
          <p className="text-xs text-muted-foreground">Carregando closers...</p>
        ) : closers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum closer disponível</p>
        ) : (
          <Select value={closerId} onValueChange={onCloserIdChange}>
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

      {/* Date/Time picker */}
      <DateTimePicker
        date={meetingDate}
        onDateChange={onMeetingDateChange}
        label="Data e Horário"
        disablePastDates
        availableTimes={availableTimes}
      />

      {!isValidDate(meetingDate) && closerId && (
        <p className="text-xs text-muted-foreground">Selecione uma data para carregar horários disponíveis.</p>
      )}
      {isValidDate(meetingDate) && !closerId && (
        <p className="text-xs text-muted-foreground">Selecione um closer para carregar horários disponíveis.</p>
      )}
      {availabilityLoading && (
        <p className="text-xs text-muted-foreground">Carregando horários disponíveis...</p>
      )}
      {hasLoadedAvailability && availableTimes.length === 0 && !availabilityLoading && (
        <p className="text-xs text-muted-foreground">Nenhum horário disponível para este dia.</p>
      )}

      {/* Meeting title */}
      <div className="grid gap-2">
        <Label htmlFor="meetingTitle" className={fieldLabelClassName}>Título da reunião</Label>
        <Input
          className={fieldInputClassName}
          id="meetingTitle"
          placeholder="Ex: Apresentação da proposta"
          value={meetingTitle}
          onChange={(e) => onMeetingTitleChange(e.target.value)}
        />
      </div>

      {/* Meeting notes */}
      <div className="grid gap-2">
        <Label htmlFor="meetingNotes" className={fieldLabelClassName}>Observações</Label>
        <Textarea
          className={fieldTextareaClassName}
          id="meetingNotes"
          placeholder="Adicione observações sobre a reunião..."
          value={meetingNotes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onMeetingNotesChange(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
