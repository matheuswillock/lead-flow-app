import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { googleConnectionEventUseCase, GoogleConnectionEventType, GoogleConnectionFlow } from "@/app/api/useCases/googleConnectionEvent/GoogleConnectionEventUseCase";

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
  await googleConnectionEventUseCase.recordClientEvent({
    eventType: eventType[parsed.data.eventType],
    flow: flow[parsed.data.flow],
    supabaseUserId: user?.id ?? null,
    errorCategory: parsed.data.errorCategory ?? null,
    requestId: parsed.data.requestId,
  });
  return NextResponse.json({ ok: true });
}
