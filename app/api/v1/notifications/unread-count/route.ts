import { NextRequest, NextResponse } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { notificationUseCase } from "@/app/api/useCases/notifications/NotificationUseCase";
import { Output } from "@/lib/output";

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const output = await notificationUseCase.countUnread({
      recipientProfileId: teamAccess.access.profileId,
      teamId: teamAccess.access.teamId,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[NotificationsUnreadCountRoute][GET] Erro ao contar notificações:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao consultar notificações"], null),
      { status: 500 }
    );
  }
}
