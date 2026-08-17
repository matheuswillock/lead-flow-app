import { NextResponse, type NextRequest } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { webPushClientErrorUseCase } from "@/app/api/useCases/notifications/WebPushClientErrorUseCase";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import type { WebPushClientErrorPayload } from "@/lib/web-push/client-error-report";

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = (await request.json()) as Partial<WebPushClientErrorPayload>;
    if (!body.action || !body.errorName) {
      return NextResponse.json(
        new Output(false, [], ["Payload de erro de Web Push inválido"], null),
        { status: 400 },
      );
    }

    const payload: WebPushClientErrorPayload = {
      action: body.action,
      errorName: body.errorName,
      errorMessage: body.errorMessage ?? "",
      userAgent: body.userAgent ?? null,
      uaBrands: body.uaBrands ?? null,
      uaPlatform: body.uaPlatform ?? null,
      uaMobile: typeof body.uaMobile === "boolean" ? body.uaMobile : null,
      language: body.language ?? null,
      isSecureContext: typeof body.isSecureContext === "boolean" ? body.isSecureContext : null,
      protocol: body.protocol ?? null,
      notificationPermission: body.notificationPermission ?? null,
      hasPushManager: Boolean(body.hasPushManager),
      hasServiceWorker: Boolean(body.hasServiceWorker),
    };

    const output = webPushClientErrorUseCase.report({
      profileId: teamAccess.access.profileId,
      teamId: teamAccess.access.teamId,
      payload,
      requestUserAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[WebPushClientErrorRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao registrar falha de Web Push"], null),
      { status: 500 },
    );
  }
}
