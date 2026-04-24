import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { EmailTemplateAssetUseCase } from "@/app/api/useCases/email/EmailTemplateAssetUseCase";
import { isManagerLikeRole } from "@/lib/roles";

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
        new Output(false, [], ["Apenas managers podem enviar imagens para templates de email"], null),
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(new Output(false, [], ["Arquivo de imagem é obrigatório"], null), {
        status: 400,
      });
    }

    const useCase = makeUseCase();
    const output = await useCase.uploadImage(image, teamAccess.access);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[EmailTemplateAssetImageRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
