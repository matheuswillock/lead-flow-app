import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { TeamMeetingDurationMinutes } from "../types";

type MockSettingsState = {
  settings: { durationMinutes: TeamMeetingDurationMinutes } | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveError: string | null;
  saveFeedback: string | null;
  retry: () => Promise<void>;
  save: () => Promise<void>;
};

let state: MockSettingsState;
const useTeamScheduleSettings = mock(() => state);

mock.module("../context/TeamScheduleSettingsContext", () => ({ useTeamScheduleSettings }));

const { TeamScheduleSettingsSection } = await import("./TeamScheduleSettingsSection");

function createState(overrides: Partial<MockSettingsState> = {}): MockSettingsState {
  return {
    settings: { durationMinutes: 30 },
    isLoading: false,
    isSaving: false,
    error: null,
    saveError: null,
    saveFeedback: null,
    retry: async () => {},
    save: async () => {},
    ...overrides,
  };
}

describe("TeamScheduleSettingsSection", () => {
  test("mantém a estrutura montada e sinaliza carregamento", () => {
    state = createState({ isLoading: true });

    const html = renderToStaticMarkup(<TeamScheduleSettingsSection />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Carregando configuração de horários");
  });

  test("expõe retry e mensagem segura no erro de carregamento", () => {
    state = createState({ error: "Não foi possível carregar a configuração de horários." });

    const html = renderToStaticMarkup(<TeamScheduleSettingsSection />);

    expect(html).toContain("Não foi possível carregar a configuração de horários.");
    expect(html).toContain("Tentar novamente");
    expect(html).toContain("min-h-11");
  });

  test("exibe o copy de slots, alvo mínimo e feedback acessível de save", () => {
    state = createState({
      saveError: "Não foi possível salvar a configuração de horários.",
      saveFeedback: "Salvando a configuração de horários...",
    });

    const html = renderToStaticMarkup(<TeamScheduleSettingsSection />);

    expect(html).toContain("Duração dos slots de reunião");
    expect(html).toContain("Salvando a configuração de horários...");
    expect(html).toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-describedby="team-meeting-duration-description team-schedule-settings-save-error"');
    expect(html).toContain("min-h-11");
  });
});
