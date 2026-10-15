import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleConnectionEventType, GoogleConnectionFlow } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabase/server";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { googleConnectionEventService } from "@/app/api/services/googleConnectionEvent/GoogleConnectionEventService";

const schema = z.object({
  eventType: z.enum(["started", "failed"]),
  flow: z.enum(["login", "account", "backoffice"]),
  requestId: z.string().min(1).max(128),
  errorCategory: z.string().trim().max(80).optional(),
});

const eventType = { started: GoogleConnectionEventType.STARTED, failed: GoogleConnectionEventType.FAILED } as const;
const flow = { login: GoogleConnectionFlow.LOGIN, account: GoogleConnectionFlow.ACCOUNT, backoffice: GoogleConnectionFlow.BACKOFFICE } as const;

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createSupabaseServer();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const profile = user ? await profileRepository.findBySupabaseId(user.id) : null;
  await googleConnectionEventService.record({
    eventType: eventType[parsed.data.eventType],
    flow: flow[parsed.data.flow],
    profileId: profile?.id ?? null,
    supabaseUserId: user?.id ?? null,
    errorCategory: parsed.data.errorCategory ?? null,
    requestId: parsed.data.requestId,
  });
  return NextResponse.json({ ok: true });
}
