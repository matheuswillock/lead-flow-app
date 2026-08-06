import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { leadDocumentRequestUseCase } from "@/app/api/useCases/leads/leadDocumentRequestUseCaseFactory";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      const output = new Output(false, [], ["Token inválido"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadDocumentRequestUseCase.getPublicRequest(token);

    if (!output.isValid) {
      return NextResponse.json(output, { status: 404 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PublicDocumentRequestRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
