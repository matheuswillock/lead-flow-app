import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { EmailTemplateAssetUseCase } from "@/app/api/useCases/email/EmailTemplateAssetUseCase";
import { isManagerLikeRole } from "@/lib/roles";

const schema = z.object({
  url: z.string().url("URL inválida"),
  theme: z.enum(["light", "dark"]),
});

function makeUseCase() {
  return new EmailTemplateAssetUseCase();
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem gerar assets de templates de email"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const validation = schema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const useCase = makeUseCase();
    const output = await useCase.generateXAsset(validation.data, teamAccess.access);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[EmailTemplateAssetXRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
