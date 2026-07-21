import { NextRequest, NextResponse } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { notificationUseCase } from "@/app/api/useCases/notifications/NotificationUseCase";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const parsedLimit = limitParam === null ? Number.NaN : Number(limitParam);
    const parsedOffset = offsetParam === null ? Number.NaN : Number(offsetParam);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

    const output = await notificationUseCase.listNotifications({
      recipientProfileId: teamAccess.access.profileId,
      limit,
      offset,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[NotificationsRoute][GET] Erro ao listar notificações:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar notificações"], null),
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const output = await notificationUseCase.markAllAsRead({
      recipientProfileId: teamAccess.access.profileId,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[NotificationsRoute][PATCH] Erro ao marcar notificações:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar notificações"], null),
      { status: 500 }
    );
  }
}
