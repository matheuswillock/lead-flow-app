import { NextResponse, type NextRequest } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { webPushSubscriptionUseCase } from "@/app/api/useCases/notifications/WebPushSubscriptionUseCase";
import { Output } from "@/lib/output";

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string | null;
  consentVersion?: string;
  source?: "login_prompt" | "settings_sheet";
};

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = (await request.json()) as SubscribeBody;
    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        new Output(false, [], ["Dados de inscrição inválidos"], null),
        { status: 400 },
      );
    }

    const output = await webPushSubscriptionUseCase.subscribe({
      profileId: teamAccess.access.profileId,
      endpoint,
      p256dh,
      auth,
      userAgent: body.userAgent ?? request.headers.get("user-agent"),
      consentVersion: body.consentVersion?.trim() ?? null,
      source: body.source ?? null,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[WebPushSubscribeRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao salvar inscrição"], null),
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = (await request.json()) as { endpoint?: string };
    const endpoint = body.endpoint?.trim();

    if (!endpoint) {
      return NextResponse.json(
        new Output(false, [], ["Endpoint de inscrição é obrigatório"], null),
        { status: 400 },
      );
    }

    const output = await webPushSubscriptionUseCase.unsubscribe({
      profileId: teamAccess.access.profileId,
      endpoint,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[WebPushSubscribeRoute][DELETE] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover inscrição"], null),
      { status: 500 },
    );
  }
}
