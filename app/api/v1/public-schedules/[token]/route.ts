import { scheduleShareUseCase } from "@/app/api/useCases/scheduleShare/ScheduleShareUseCase";
import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const output = await scheduleShareUseCase.getPublicShare(token);
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    console.error("[PublicScheduleShareApiRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor."], null), { status: 500 });
  }
}
