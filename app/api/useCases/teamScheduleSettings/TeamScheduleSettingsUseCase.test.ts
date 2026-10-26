import { describe, expect, test } from "bun:test";
import { TeamScheduleSettingsUseCase } from "./TeamScheduleSettingsUseCase";
import type { ITeamScheduleSettingsRepository } from "@/app/api/infra/data/repositories/teamScheduleSettings/ITeamScheduleSettingsRepository";

function createRepository(duration = 30): ITeamScheduleSettingsRepository {
  let storedDuration = duration;
  return {
    async findMeetingDuration() {
      return storedDuration as 30;
    },
    async updateMeetingDuration(input) {
      storedDuration = input.durationMinutes;
      return input.durationMinutes;
    },
  };
}

describe("TeamScheduleSettingsUseCase", () => {
  test("persists an allowed duration", async () => {
    const useCase = new TeamScheduleSettingsUseCase(createRepository());

    const output = await useCase.update({ teamId: "team-1", durationMinutes: 45 });

    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({ durationMinutes: 45 });
  });

  test("rejects a duration outside the fixed catalog", async () => {
    const useCase = new TeamScheduleSettingsUseCase(createRepository());

    const output = await useCase.update({ teamId: "team-1", durationMinutes: 42 as 45 });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toContain("A duração deve ser de 5 a 60 minutos, em intervalos de 5.");
  });
});
