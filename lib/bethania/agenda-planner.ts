import { formatIntimezone } from "@/lib/dates";
import { classifyScheduleChange, getMeetingEnd } from "./agenda-rules";
import { getLocalAgendaSlot } from "./agenda-scheduler";

export type BethaniaAgendaProfile = {
  id: string;
  supabaseId?: string | null;
  timezone: string;
};

export type BethaniaAppointment = {
  id: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  date: Date;
  durationMinutes: number | null;
  meetingHeald: "yes" | "no" | null;
  status: string | null;
};

export type BethaniaAgendaPlan = {
  profileId: string;
  eventType: "schedule.created_or_rescheduled" | "agenda.daily_0700" | "meeting.follow_up_1h" | "agenda.overdue_1500";
  idempotencyKey: string;
  message: string;
};

function cleanLeadName(name: string): string {
  const normalized = name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.slice(0, 80) || "Lead";
}

function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function appUrl(baseUrl: string, profileId: string, leadCode?: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new TypeError("Bethânia app URL must be valid");
  }
  const localHttp = base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname);
  if ((!localHttp && base.protocol !== "https:") || base.username || base.password) {
    throw new TypeError("Bethânia app URL must use HTTPS");
  }
  const path = `/${encodeURIComponent(profileId)}/crm`;
  const url = new URL(path, base.origin);
  if (leadCode) url.searchParams.set("leadCode", leadCode);
  return url.toString();
}

function isActive(appointment: BethaniaAppointment): boolean {
  return appointment.status === "scheduled" && appointment.meetingHeald !== "yes";
}

function sortAppointments(appointments: BethaniaAppointment[]): BethaniaAppointment[] {
  return [...appointments].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildScheduleChangePlan(input: {
  scheduleId: string;
  profile: BethaniaAgendaProfile;
  actorProfileId: string;
  previousDate: Date | null;
  nextDate: Date;
  updatedAt: Date;
  leadName: string;
}): BethaniaAgendaPlan | null {
  const classification = classifyScheduleChange({
    previousDate: input.previousDate,
    nextDate: input.nextDate,
    actorProfileId: input.actorProfileId,
    recipientProfileId: input.profile.id,
  });
  if (!classification.shouldNotify) return null;
  const action = classification.change === "created" ? "criado" : "reagendado";
  const when = formatIntimezone(input.nextDate, "dd/MM/yyyy 'às' HH:mm", input.profile.timezone);
  return {
    profileId: input.profile.id,
    eventType: "schedule.created_or_rescheduled",
    idempotencyKey: `schedule:${input.scheduleId}:${input.updatedAt.toISOString()}`,
    message: `Agendamento ${action} para ${cleanLeadName(input.leadName)} em ${when}.`,
  };
}

export function planBrokerAgendaEvents(input: {
  profile: BethaniaAgendaProfile;
  appointments: BethaniaAppointment[];
  now: Date;
  appBaseUrl: string;
}): BethaniaAgendaPlan[] {
  if (!Number.isFinite(input.now.getTime())) throw new TypeError("now must be a valid date");
  const timezone = input.profile.timezone || "America/Sao_Paulo";
  const localDate = localDateKey(input.now, timezone);
  const active = sortAppointments(input.appointments.filter(isActive));
  const today = active.filter((appointment) => localDateKey(appointment.date, timezone) === localDate);
  const plans: BethaniaAgendaPlan[] = [];

  if (getLocalAgendaSlot(input.now, timezone, 7).isDue && today.length > 0) {
    const lines = today.map((appointment) =>
      `• ${formatIntimezone(appointment.date, "HH:mm", timezone)} · ${cleanLeadName(appointment.leadName)}`,
    );
    plans.push({
      profileId: input.profile.id,
      eventType: "agenda.daily_0700",
      idempotencyKey: `agenda.daily_0700:${input.profile.id}:${localDate}`,
      message: `Agenda de hoje — ${formatIntimezone(input.now, "dd/MM", timezone)}:\n${lines.join("\n")}`,
    });
  }

  const followUpCandidates = active.filter((appointment) => {
    const end = new Date(getMeetingEnd(appointment.date, appointment.durationMinutes));
    const dueAt = end.getTime() + 60 * 60 * 1000;
    return dueAt <= input.now.getTime();
  });
  for (const appointment of followUpCandidates) {
    if (!input.profile.supabaseId) throw new TypeError("Bethânia follow-up requires the profile route id");
    const url = appUrl(input.appBaseUrl, input.profile.supabaseId, appointment.leadCode);
    plans.push({
      profileId: input.profile.id,
      eventType: "meeting.follow_up_1h",
      idempotencyKey: `meeting.follow_up_1h:${appointment.id}:${appointment.date.toISOString()}`,
      message: `A reunião com ${cleanLeadName(appointment.leadName)} já terminou há uma hora. Ela aconteceu? Atualize o agendamento: ${url}`,
    });
  }

  if (getLocalAgendaSlot(input.now, timezone, 15).isDue) {
    const overdue = active.filter((appointment) => {
      const dateOnLocalDay = localDateKey(appointment.date, timezone) === localDate;
      const end = new Date(getMeetingEnd(appointment.date, appointment.durationMinutes));
      return dateOnLocalDay && end.getTime() <= input.now.getTime();
    });
    if (overdue.length > 0) {
      const lines = overdue.map((appointment) =>
        `• ${formatIntimezone(appointment.date, "HH:mm", timezone)} · ${cleanLeadName(appointment.leadName)}`,
      );
      plans.push({
        profileId: input.profile.id,
        eventType: "agenda.overdue_1500",
        idempotencyKey: `agenda.overdue_1500:${input.profile.id}:${localDate}`,
        message: `Pendências da agenda de hoje — ${formatIntimezone(input.now, "dd/MM", timezone)}:\n${lines.join("\n")}\nAtualize o resultado de cada reunião no CRM.`,
      });
    }
  }

  return plans;
}
