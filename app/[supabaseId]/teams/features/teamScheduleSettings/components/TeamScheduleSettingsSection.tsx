"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingDurationSelect } from "./MeetingDurationSelect";
import { useTeamScheduleSettings } from "../context/TeamScheduleSettingsContext";
import type { TeamMeetingDurationMinutes } from "../types";

const DEFAULT_DURATION_MINUTES: TeamMeetingDurationMinutes = 30;

export function TeamScheduleSettingsSection() {
  const { settings, isLoading, isSaving, error, saveError, saveFeedback, retry, save } = useTeamScheduleSettings();
  const [durationMinutes, setDurationMinutes] = useState<TeamMeetingDurationMinutes>(DEFAULT_DURATION_MINUTES);

  useEffect(() => {
    if (settings) setDurationMinutes(settings.durationMinutes);
  }, [settings]);

  return (
    <section aria-labelledby="team-schedule-settings-title" aria-busy={isLoading} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 id="team-schedule-settings-title" className="text-xl font-semibold tracking-tight">Horários do time</h2>
        <p className="text-sm text-muted-foreground">
          Escolha a duração fixa de cada slot. Ela define de quanto em quanto tempo novos horários ficam disponíveis para SDRs e formulários deste time.
        </p>
      </div>

      {isLoading ? <Skeleton aria-label="Carregando configuração de horários" className="h-32 w-full" /> : null}

      {!isLoading && error ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void retry()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="team-meeting-duration">Duração dos slots de reunião</FieldLabel>
              <FieldDescription id="team-meeting-duration-description">
                Todos os slots terão a duração escolhida. Use uma duração que corresponda ao tempo médio das reuniões do time.
              </FieldDescription>
            </FieldContent>
            <MeetingDurationSelect
              value={durationMinutes}
              disabled={isSaving}
              onValueChange={setDurationMinutes}
              aria-describedby={
                saveError
                  ? "team-meeting-duration-description team-schedule-settings-save-error"
                  : "team-meeting-duration-description"
              }
            />
          </Field>
          {saveError ? (
            <p id="team-schedule-settings-save-error" role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void save(durationMinutes)}
              disabled={isSaving || durationMinutes === settings?.durationMinutes}
              className="min-h-11"
            >
              {isSaving ? "Salvando..." : "Salvar duração dos slots"}
            </Button>
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
            {saveFeedback}
          </p>
        </FieldGroup>
      ) : null}
    </section>
  );
}
