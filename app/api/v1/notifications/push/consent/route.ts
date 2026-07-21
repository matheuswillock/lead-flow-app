import { NextResponse, type NextRequest } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { webPushConsentUseCase } from "@/app/api/useCases/notifications/WebPushConsentUseCase";
import type { WebPushConsentSource } from "@/lib/web-push/types";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RecordConsentBody = {
  status?: "declined" | "dismissed";
  source?: WebPushConsentSource;
  consentVersion?: string;
};

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const output = await webPushConsentUseCase.getConsent({
      profileId: teamAccess.access.profileId,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[WebPushConsentRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao buscar consentimento"], null),
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = (await request.json()) as RecordConsentBody;
    const status = body.status;
    const consentVersion = body.consentVersion?.trim();

    if (status !== "declined" && status !== "dismissed") {
      return NextResponse.json(
        new Output(false, [], ["Status de consentimento inválido"], null),
        { status: 400 },
      );
    }

    if (!consentVersion) {
      return NextResponse.json(
        new Output(false, [], ["Versão de consentimento é obrigatória"], null),
        { status: 400 },
      );
    }

    const output = await webPushConsentUseCase.recordConsent({
      profileId: teamAccess.access.profileId,
      status,
      consentVersion,
      source: body.source,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[WebPushConsentRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao salvar consentimento"], null),
      { status: 500 },
    );
  }
}
