import { NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { isPublicFormAllowedOnRequestHost } from "@/lib/public-forms/team-form-domain-tenancy"

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  await connection();

  const { publicId } = await params

  // Tenancy do host custom — mesma regra da página `app/forms/[publicId]`.
  if (!(await isPublicFormAllowedOnRequestHost(request.headers.get("host"), publicId))) {
    return NextResponse.json(new Output(false, [], ["Formulário não encontrado"], null), { status: 404 })
  }

  const output = await publicFormsUseCase.getPublic(publicId)
  return NextResponse.json(output, {
    status: output.isValid ? 200 : 404,
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  })
}
