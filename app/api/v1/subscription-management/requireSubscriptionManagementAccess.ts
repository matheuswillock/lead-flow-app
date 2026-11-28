import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import {
  requireActiveAccountAccess,
  requireWritableAccountAccess,
} from "@/app/api/v1/utils/requireActiveAccountAccess";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";

export async function requireSubscriptionManagementAccess(
  request: NextRequest,
  mode: "read" | "write"
): Promise<NextResponse | null> {
  const authenticatedSupabaseId = request.headers.get("x-supabase-user-id");
  if (!authenticatedSupabaseId) {
    return NextResponse.json(
      new Output(false, [], ["Não autenticado"], null),
      { status: 401 }
    );
  }

  const accountDenied =
    mode === "write"
      ? await requireWritableAccountAccess(authenticatedSupabaseId)
      : await requireActiveAccountAccess(authenticatedSupabaseId);
  if (accountDenied) {
    return accountDenied;
  }

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  if (!hasDelegatedTeamManagementAccess(teamAccess.access)) {
    return NextResponse.json(
      new Output(
        false,
        [],
        ["Acesso restrito ao master ou gerente delegado"],
        null
      ),
      { status: 403 }
    );
  }

  return null;
}
