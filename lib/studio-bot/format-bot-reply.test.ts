import { describe, expect, it } from "bun:test";
import { formatActionReply, formatAgendaTodayReply, formatMeetingScheduledReply } from "./format-bot-reply";

// 2026-07-15T17:30Z = 14:30 em Brasília, 13:30 em Cuiabá e 12:30 no Acre.
const meeting = "2026-07-15T17:30:00.000Z";

describe("respostas do robô no fuso da conta", () => {
  it("sem fuso informado, mantém o horário de Brasília", () => {
    expect(formatMeetingScheduledReply(meeting, "Visita")).toContain("15/07, 14:30");
  });

  it("agenda de hoje usa o fuso do usuário", () => {
    const reply = formatAgendaTodayReply([{ date: meeting, meetingTitle: "Visita" }], "America/Rio_Branco");
    expect(reply).toContain("12:30 — Lead — Visita");
  });

  it("reunião agendada e detalhe do lead seguem o fuso", () => {
    expect(formatActionReply("schedule_meeting", { meetingDate: meeting }, [], "America/Cuiaba")).toContain("15/07, 13:30");
    expect(
      formatActionReply("lead_detail", { lead: { leadCode: 7, name: "Ana", meetingDate: meeting } }, [], "America/Rio_Branco")
    ).toContain("Reunião — 15/07, 12:30");
  });

  it("tarefas seguem o fuso", () => {
    expect(formatActionReply("list_tasks", [{ title: "Ligar", endAt: meeting }], [], "America/Noronha")).toContain(
      "Ligar — 15/07, 15:30"
    );
  });
});
