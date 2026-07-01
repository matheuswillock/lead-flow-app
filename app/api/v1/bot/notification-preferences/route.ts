import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { backofficeBotNotificationPreferenceUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotNotificationPreferenceUseCase";
import { getBotProductAccess } from "@/app/api/v1/bot/utils/getBotProductAccess";
import { verifyStudioBotRequest } from "@/app/api/v1/bot/utils/verifyStudioBotRequest";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const putSchema = z.object({
  type: z.string().min(1),
  enabled: z.boolean(),
  quietHours: z.record(z.string(), z.unknown()).optional(),
});

async function resolveProfileId(request: NextRequest): Promise<
  | { profileId: string; error?: never; status?: never }
  | { profileId?: never; error: Output; status: number }
> {
  const hmac = request.headers.get("x-studio-bot-signature");
  if (hmac) {
    const userLinkId = request.headers.get("x-bot-user-link-id");
    if (!userLinkId) {
      return {
        error: new Output(false, [], ["x-bot-user-link-id é obrigatório"], null),
        status: 400,
      };
    }
    return backofficeBotNotificationPreferenceUseCase.resolveProfileIdFromUserLink(userLinkId);
  }

  const access = await getBotProductAccess(request);
  if (access.error) {
    return { error: access.error, status: access.status };
  }
  return { profileId: access.access.profileId };
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveProfileId(request);
    if (resolved.error) {
      return NextResponse.json(resolved.error, { status: resolved.status });
    }

    const output = await backofficeBotNotificationPreferenceUseCase.listPreferences(
      resolved.profileId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotNotificationPreferencesRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const hmacHeader = request.headers.get("x-studio-bot-signature");
    let parsedBody: z.infer<typeof putSchema>;

    if (hmacHeader) {
      const verified = await verifyStudioBotRequest(request);
      if (!verified.ok) {
        return NextResponse.json(verified.error, { status: verified.status });
      }
      const parsed = putSchema.safeParse(JSON.parse(verified.body));
      if (!parsed.success) {
        return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
      }
      parsedBody = parsed.data;
    } else {
      const parsed = putSchema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
      }
      parsedBody = parsed.data;
    }

    const resolved = await resolveProfileId(request);
    if (resolved.error) {
      return NextResponse.json(resolved.error, { status: resolved.status });
    }

    const output = await backofficeBotNotificationPreferenceUseCase.upsertPreference(
      resolved.profileId,
      parsedBody.type,
      parsedBody.enabled,
      parsedBody.quietHours
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotNotificationPreferencesRoute][PUT]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
