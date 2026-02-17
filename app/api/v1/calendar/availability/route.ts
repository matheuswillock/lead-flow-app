import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { getCalendarBusyIntervals } from "@/app/api/services/googleCalendar/GoogleCalendarService";

const schema = z
  .object({
    closerId: z.string().uuid().optional(),
    closerIds: z.array(z.string().uuid()).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((data) => data.closerId || (data.closerIds && data.closerIds.length > 0), {
    message: "Informe um closerId ou closerIds.",
    path: ["closerId"],
  });

const SLOT_MINUTES = 30;
const TIMEZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const getMinutesInDay = (date: Date) => {
  const parts = timeFormatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
};

const formatTimeSlot = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const payload = await request.json().catch(() => null);
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { closerId, closerIds, date } = validation.data;
    const requestedCloserIds = Array.from(
      new Set([...(closerIds ?? []), ...(closerId ? [closerId] : [])])
    );

    if (requestedCloserIds.length === 0) {
      const output = new Output(false, [], ["Informe um closerId ou closerIds."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: teamAccess.access.teamId,
        profileId: { in: requestedCloserIds },
      },
      select: { profileId: true },
    });

    if (teamMembers.length !== requestedCloserIds.length) {
      const output = new Output(false, [], ["Um ou mais closers não pertencem ao time informado."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const closerProfiles = await prisma.profile.findMany({
      where: { id: { in: requestedCloserIds } },
      select: {
        id: true,
        email: true,
        googleCalendarConnected: true,
        googleRefreshToken: true,
        googleAccessToken: true,
        googleTokenExpiresAt: true,
        supabaseId: true,
      },
    });

    if (closerProfiles.length === 0) {
      const output = new Output(false, [], ["Closers não encontrados."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const dayStart = new Date(`${date}T00:00:00-03:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const timeMin = `${date}T00:00:00-03:00`;
    const timeMax = `${date}T23:59:59-03:00`;

    const internalLeads = await prisma.lead.findMany({
      where: {
        teamId: teamAccess.access.teamId,
        closerId: { in: requestedCloserIds },
        status: "scheduled",
        meetingDate: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: { meetingDate: true, closerId: true },
    });

    const internalBusyByCloser = internalLeads.reduce<Record<string, Array<{ start: string; end: string }>>>(
      (acc, lead) => {
        if (!lead.meetingDate || !lead.closerId) return acc;
        const start = lead.meetingDate as Date;
        const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
        acc[lead.closerId] = acc[lead.closerId] || [];
        acc[lead.closerId].push({ start: start.toISOString(), end: end.toISOString() });
        return acc;
      },
      {}
    );

    const now = new Date();
    const todayKey = dateFormatter.format(now);
    const isToday = date === todayKey;
    const nowMinutes = getMinutesInDay(now);

    const slots = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => {
      return index * SLOT_MINUTES;
    });

    const computeAvailability = (busyIntervals: Array<{ start: string; end: string }>) => {
      return slots
        .filter((slotStart) => {
          if (isToday && slotStart < nowMinutes) {
            return false;
          }

          const slotEnd = slotStart + SLOT_MINUTES;

          return !busyIntervals.some((interval) => {
            const startDate = new Date(interval.start);
            const endDate = new Date(interval.end);
            if (endDate <= dayStart || startDate >= dayEnd) return false;

            const startClamp = startDate < dayStart ? dayStart : startDate;
            const endClamp = endDate > dayEnd ? dayEnd : endDate;

            const busyStart = getMinutesInDay(startClamp);
            const busyEnd = getMinutesInDay(endClamp);

            return slotStart < busyEnd && slotEnd > busyStart;
          });
        })
        .map(formatTimeSlot);
    };

    const perCloser: Record<string, string[]> = {};
    let source: "google" | "internal" = "internal";

    for (const closerProfile of closerProfiles) {
      const canUseGoogleCalendar =
        !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
      let busyIntervals: Array<{ start: string; end: string }> = [];
      let usedGoogle = false;

      if (canUseGoogleCalendar) {
        try {
          busyIntervals = await getCalendarBusyIntervals({
            organizer: closerProfile as any,
            timeMin,
            timeMax,
          });
          usedGoogle = true;
        } catch (error) {
          console.warn(
            "Falha ao buscar disponibilidade no Google Calendar, usando fallback interno.",
            error
          );
        }
      }

      if (!usedGoogle) {
        busyIntervals = internalBusyByCloser[closerProfile.id] ?? [];
      }

      perCloser[closerProfile.id] = computeAvailability(busyIntervals);
      if (usedGoogle) {
        source = "google";
      }
    }

    const availableTimes = Array.from(
      new Set(Object.values(perCloser).flat())
    ).sort((a, b) => {
      const [ah, am] = a.split(":").map(Number);
      const [bh, bm] = b.split(":").map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });

    const output = new Output(true, [], [], {
      availableTimes,
      source,
      perCloser,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar disponibilidade:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
