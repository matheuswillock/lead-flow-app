import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import {
  uploadDialerContactsUseCase,
  DIALER_UPLOAD_ERROR_MESSAGES,
} from "@/app/api/useCases/dialer/UploadDialerContactsUseCase";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const XLSX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

function resolveFileType(file: File): "xlsx" | "json" | null {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || XLSX_MIME_TYPES.includes(file.type)) {
    return "xlsx";
  }
  if (lowerName.endsWith(".json") || file.type === "application/json") {
    return "json";
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    if (!isManagerOrMaster(access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem fazer upload de contatos"], null),
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        new Output(false, [], ['Campo "file" é obrigatório no formulário'], null),
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        new Output(false, [], ["Arquivo excede o limite de 10MB"], null),
        { status: 400 }
      );
    }

    const fileType = resolveFileType(file);
    if (!fileType) {
      return NextResponse.json(
        new Output(false, [], ["Formato não suportado. Envie um arquivo .xlsx ou .json"], null),
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { campaignId } = await params;
    const output = await uploadDialerContactsUseCase.uploadContacts(
      { teamId: access.teamId, profileId: access.profileId },
      campaignId,
      { fileName: file.name, fileType, buffer }
    );

    const status = output.isValid
      ? 201
      : output.errorMessages.join(" ").includes(DIALER_UPLOAD_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND)
        ? 404
        : 400;

    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("[DialerContactsUploadRoute][POST]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao processar upload de contatos"], null),
      { status: 500 }
    );
  }
}
