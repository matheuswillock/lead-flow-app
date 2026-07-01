import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotChannelUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotChannelUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const upsertSchema = z.object({
  displayName: z.string().min(1).optional(),
  aboutText: z.string().max(139).nullable().optional(),
  n8nInboundUrl: z.string().url().nullable().optional(),
  status: z.enum(["pending", "connected", "disconnected", "error"]).optional(),
});

const patchSchema = upsertSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeBotChannelUseCase.getChannel();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotChannelRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const parsed = upsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeBotChannelUseCase.upsertChannel(parsed.data);
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotChannelRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeBotChannelUseCase.upsertChannel(parsed.data);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotChannelRoute][PATCH]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
