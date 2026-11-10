import { NextResponse } from "next/server";
import { Output } from "@/lib/output";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";

/**
 * A equipe Corretor Studio (Manager do backoffice) atende dentro da conta do
 * cliente, mas não paga nem exporta dados dele. Rotas com essas ações chamam
 * este auxiliar logo após `getTeamAccess`.
 */
export function denyIfSupportAccess(
  access: Pick<TeamAccess, "isSupportAccess">,
  action: string,
): NextResponse | null {
  if (!access.isSupportAccess) return null;

  return NextResponse.json(
    new Output(false, [], [`A equipe de suporte não pode ${action} desta conta.`], null),
    { status: 403 },
  );
}
