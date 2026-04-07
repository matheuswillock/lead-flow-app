import { Output } from "@/lib/output";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { getCalendarEventAttendees } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import type { IGetScheduleAttendeesUseCase } from "./IGetScheduleAttendeesUseCase";
import type {
  AttendeeRole,
  GetScheduleAttendeesInput,
  LeadCloserForCalendar,
  ScheduleAttendee,
} from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";

const ROLE_ORDER: AttendeeRole[] = ["closer", "sdr", "lead", "extra"];

export class GetScheduleAttendeesUseCase implements IGetScheduleAttendeesUseCase {
  async execute(input: GetScheduleAttendeesInput): Promise<Output> {
    const { leadId, teamId, hints } = input;

    const schedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    if (!schedule) {
      return new Output(true, [], [], []);
    }

    const roleMap = new Map<string, AttendeeRole>();
    const needsGoogleRsvp = !!schedule.googleEventId;

    let closerForGoogle: LeadCloserForCalendar | null = null;

    const hintCloserEmail = hints?.closerEmail?.toLowerCase().trim() || null;
    const hintSdrEmail = hints?.sdrEmail?.toLowerCase().trim() || null;
    const hintLeadEmail = hints?.leadEmail?.toLowerCase().trim() || null;
    const hasHints = !!(hintCloserEmail || hintSdrEmail || hintLeadEmail);

    if (hasHints) {
      // Monta roleMap a partir dos hints do frontend — evita busca completa do lead
      if (hintCloserEmail) roleMap.set(hintCloserEmail, "closer");
      if (hintSdrEmail && hintSdrEmail !== hintCloserEmail) roleMap.set(hintSdrEmail, "sdr");
      if (hintLeadEmail) roleMap.set(hintLeadEmail, "lead");

      // Se há evento no Google Calendar, precisa dos tokens OAuth do closer
      if (needsGoogleRsvp) {
        const closer = await leadRepository.findCloserForCalendar(leadId);
        closerForGoogle = closer;
      }
    } else {
      // Sem hints: busca completa do lead para montar roleMap
      const lead = await leadRepository.findForAttendeesRoleMap(leadId);

      if (!lead || lead.teamId !== teamId) {
        return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      }

      const closerEmail = lead.closer?.email?.toLowerCase().trim();
      const sdrEmail = lead.assignee?.email?.toLowerCase().trim();
      const leadEmail = lead.email?.toLowerCase().trim();

      if (closerEmail) roleMap.set(closerEmail, "closer");
      if (sdrEmail && sdrEmail !== closerEmail) roleMap.set(sdrEmail, "sdr");
      if (leadEmail) roleMap.set(leadEmail, "lead");

      closerForGoogle = lead.closer;
    }

    for (const guest of schedule.extraGuests ?? []) {
      const g = guest.toLowerCase().trim();
      if (!roleMap.has(g)) roleMap.set(g, "extra");
    }

    const canUseGoogle =
      needsGoogleRsvp &&
      !!closerForGoogle?.googleCalendarConnected &&
      !!closerForGoogle?.googleRefreshToken;

    let attendees: ScheduleAttendee[];
    let resolvedHasGoogleData = false;

    if (canUseGoogle && closerForGoogle) {
      try {
        const googleAttendees = await getCalendarEventAttendees({
          organizer: closerForGoogle as Parameters<typeof getCalendarEventAttendees>[0]["organizer"],
          eventId: schedule.googleEventId!,
          calendarId: schedule.googleCalendarId ?? "primary",
        });

        attendees = googleAttendees.map((a) => ({
          email: a.email,
          displayName: a.displayName ?? null,
          role: roleMap.get(a.email.toLowerCase().trim()) ?? "extra",
          responseStatus: a.responseStatus,
        }));

        for (const [email, role] of roleMap.entries()) {
          if (!attendees.some((a) => a.email.toLowerCase().trim() === email)) {
            attendees.push({ email, displayName: null, role, responseStatus: "needsAction" });
          }
        }

        resolvedHasGoogleData = true;
      } catch (googleError) {
        console.error("[GetScheduleAttendeesUseCase][execute] Falha ao buscar RSVP do Google Calendar, usando fallback:", googleError);
        attendees = Array.from(roleMap.entries()).map(([email, role]) => ({
          email,
          displayName: null,
          role,
          responseStatus: "needsAction" as const,
        }));
      }
    } else {
      attendees = Array.from(roleMap.entries()).map(([email, role]) => ({
        email,
        displayName: null,
        role,
        responseStatus: "needsAction" as const,
      }));
    }

    attendees.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));

    return new Output(true, [], [], {
      attendees,
      hasGoogleData: resolvedHasGoogleData,
      scheduleId: schedule.id,
    });
  }
}

export const getScheduleAttendeesUseCase = new GetScheduleAttendeesUseCase();
