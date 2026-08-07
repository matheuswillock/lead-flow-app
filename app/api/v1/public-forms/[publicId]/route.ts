import { NextResponse, connection } from "next/server";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"

export async function GET(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  await connection();

  const { publicId } = await params
  const output = await publicFormsUseCase.getPublic(publicId)
  return NextResponse.json(output, {
    status: output.isValid ? 200 : 404,
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  })
}
