"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingDurationSelect } from "./MeetingDurationSelect";
import { useTeamScheduleSettings } from "../context/TeamScheduleSettingsContext";
import type { TeamMeetingDurationMinutes } from "../types";

export function TeamScheduleSettingsSection() {
  const { settings, isLoading, isSaving, error, save } = useTeamScheduleSettings();
  const [durationMinutes, setDurationMinutes] = useState<TeamMeetingDurationMinutes>(30);

  useEffect(() => {
    if (settings) setDurationMinutes(settings.durationMinutes);
  }, [settings]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;

  return (
    <FieldGroup>
      <Field>
        <FieldContent>
          <FieldLabel htmlFor="team-meeting-duration">Duração fixa da reunião</FieldLabel>
          <FieldDescription>
            Esta duração define os horários disponíveis para SDRs e formulários deste time.
          </FieldDescription>
        </FieldContent>
        <MeetingDurationSelect value={durationMinutes} disabled={isSaving} onValueChange={setDurationMinutes} />
      </Field>
      <div className="flex justify-end">
        <Button type="button" onClick={() => void save(durationMinutes)} disabled={isSaving || durationMinutes === settings?.durationMinutes} className="max-lg:h-11!">
          {isSaving ? "Salvando..." : "Salvar duração"}
        </Button>
      </div>
    </FieldGroup>
  );
}
