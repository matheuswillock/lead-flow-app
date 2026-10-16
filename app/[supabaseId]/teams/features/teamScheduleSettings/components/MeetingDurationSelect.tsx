"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEAM_MEETING_DURATION_OPTIONS, type TeamMeetingDurationMinutes } from "../types";

export function MeetingDurationSelect({
  value,
  disabled,
  onValueChange,
}: {
  value: TeamMeetingDurationMinutes;
  disabled: boolean;
  onValueChange: (value: TeamMeetingDurationMinutes) => void;
}) {
  return (
    <Select value={String(value)} disabled={disabled} onValueChange={(nextValue) => onValueChange(Number(nextValue) as TeamMeetingDurationMinutes)}>
      <SelectTrigger id="team-meeting-duration" aria-label="Duração da reunião">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TEAM_MEETING_DURATION_OPTIONS.map((duration) => (
          <SelectItem key={duration} value={String(duration)}>
            {duration} minutos
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
