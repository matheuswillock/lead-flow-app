import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import {
  supportRequestUseCase,
} from "@/app/api/useCases/support/SupportRequestUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import type {
  SupportRequestAttachmentInput,
} from "@/app/api/useCases/support/ISupportRequestUseCase";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const subject = String(formData.get("subject") || "");
    const message = String(formData.get("message") || "");
    const requesterName = String(formData.get("requesterName") || "");
    const requesterEmail = String(formData.get("requesterEmail") || "");

    const files = formData
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File);

    const attachments: SupportRequestAttachmentInput[] = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const contentBase64 = Buffer.from(arrayBuffer).toString("base64");

        return {
          fileName: file.name,
          contentType: file.type,
          contentBase64,
          size: file.size,
        };
      }),
    );

    const output = await supportRequestUseCase.createSupportRequest({
      subject,
      message,
      requesterName,
      requesterEmail,
      attachments,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[SupportRoute][POST] Erro ao criar pedido de suporte:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao enviar pedido de suporte"], null),
      { status: 500 },
    );
  }
}
