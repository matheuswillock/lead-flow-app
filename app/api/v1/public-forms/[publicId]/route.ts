import { NextResponse, connection } from "next/server";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { rejectPublicFormRequestOnForeignHost } from "@/lib/public-forms/public-form-host-tenancy-guard"

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  await connection();

  const { publicId } = await params
  const foreignHost = await rejectPublicFormRequestOnForeignHost(request, publicId)
  if (foreignHost) return foreignHost

  const output = await publicFormsUseCase.getPublic(publicId)
  return NextResponse.json(output, {
    status: output.isValid ? 200 : 404,
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  })
}
