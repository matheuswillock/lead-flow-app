import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { leadDocumentRequestUseCase } from "@/app/api/useCases/leads/leadDocumentRequestUseCaseFactory";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; itemId: string }> }
) {
  try {
    const { token, itemId } = await params;
    if (!token || !itemId) {
      const output = new Output(false, [], ["Parâmetros inválidos"], null);
      return NextResponse.json(output, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      const output = new Output(false, [], ["Corpo da requisição inválido"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      const output = new Output(false, [], ["Arquivo não encontrado no formulário"], null);
      return NextResponse.json(output, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      const output = new Output(false, [], ["Arquivo excede o tamanho máximo de 10 MB"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const output = await leadDocumentRequestUseCase.uploadItem(itemId, token, {
      buffer,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    if (!output.isValid) {
      const status = output.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
      return NextResponse.json(output, { status });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PublicDocumentRequestUploadRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
