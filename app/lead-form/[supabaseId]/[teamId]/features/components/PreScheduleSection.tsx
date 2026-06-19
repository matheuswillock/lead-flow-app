"use client";

import { useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import { usePublicLeadFormContext } from "../context/PublicLeadFormContext";
import {
  formatLocalDateValue,
  formatLocalTimeValue,
  parseDateKeyAndTimeToUtc,
} from "@/lib/dates";

interface PreScheduleSectionProps {
  meetingDate: Date | undefined;
  onMeetingDateChange: (date: Date | undefined) => void;
  disabled?: boolean;
}

const isValidDate = (value?: Date): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const PRE_SCHEDULE_SLOT_START = 7 * 60;
const PRE_SCHEDULE_SLOT_END = 20 * 60;
const SLOT_STEP = 30;

export function PreScheduleSection({
  meetingDate,
  onMeetingDateChange,
  disabled = false,
}: PreScheduleSectionProps) {
  const {
    timezone,
    preScheduleOccupiedSlots,
    preScheduleSlotsLoading,
    fetchPreScheduleSlots,
  } = usePublicLeadFormContext();

  const meetingDateKey = isValidDate(meetingDate) ? formatLocalDateValue(meetingDate, timezone) : null;

  useEffect(() => {
    if (!meetingDateKey) return;
    void fetchPreScheduleSlots(meetingDateKey);
  }, [meetingDateKey, fetchPreScheduleSlots]);

  const availableTimes = useMemo(() => {
    if (!isValidDate(meetingDate) || !meetingDateKey) return [];
    const slots: string[] = [];
    for (let mins = PRE_SCHEDULE_SLOT_START; mins <= PRE_SCHEDULE_SLOT_END; mins += SLOT_STEP) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
    return slots.filter((slotTime) => {
      const slotDate = parseDateKeyAndTimeToUtc(meetingDateKey, slotTime, timezone);
      const utcMins = slotDate.getUTCHours() * 60 + Math.floor(slotDate.getUTCMinutes() / 30) * 30;
      return !preScheduleOccupiedSlots.includes(utcMins);
    });
  }, [meetingDate, meetingDateKey, preScheduleOccupiedSlots, timezone]);

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

  return (
    <div className="space-y-4">
      <DateTimePicker
        date={meetingDate}
        onDateChange={onMeetingDateChange}
        label="Data e Horário do Pré-agendamento"
        required
        disabled={disabled}
        disablePastDates
        availableTimes={availableTimes}
        timeLoading={preScheduleSlotsLoading}
        timeLoadingText="Verificando disponibilidade..."
        tz={timezone}
      />

      {!isValidDate(meetingDate) && (
        <p className="text-xs text-muted-foreground">
          Selecione uma data para carregar os horários disponíveis.
        </p>
      )}

      {isValidDate(meetingDate) && preScheduleSlotsLoading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Verificando horários disponíveis...
        </p>
      )}

      {isValidDate(meetingDate) && !preScheduleSlotsLoading && availableTimes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum horário disponível para este dia.
        </p>
      )}
    </div>
  );
}
