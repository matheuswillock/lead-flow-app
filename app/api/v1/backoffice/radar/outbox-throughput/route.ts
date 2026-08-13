import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { backofficeRadarOutboxThroughputUseCase } from "@/app/api/useCases/backofficeRadarOutboxThroughput/BackofficeRadarOutboxThroughputUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import {
  RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE,
  RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE,
  RADAR_SYNC_MAX_CONCURRENCY,
  RADAR_SYNC_MIN_CONCURRENCY,
} from "@/lib/email/email-contact-radar-sync-outbox-config";

const patchSchema = z.object({
  batchSize: z
    .number()
    .int()
    .min(RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE)
    .max(RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE),
  concurrency: z
    .number()
    .int()
    .min(RADAR_SYNC_MIN_CONCURRENCY)
    .max(RADAR_SYNC_MAX_CONCURRENCY),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeRadarOutboxThroughputUseCase.get();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeRadarOutboxThroughputRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireManagerAccess(access.access);
    if (denied) return denied;

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          [
            `Payload inválido: batch ${RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MIN_BATCH_SIZE}–${RADAR_EMAIL_CONTACT_SYNC_OUTBOX_MAX_BATCH_SIZE}, concorrência ${RADAR_SYNC_MIN_CONCURRENCY}–${RADAR_SYNC_MAX_CONCURRENCY}`,
          ],
          null
        ),
        { status: 400 }
      );
    }

    const output = await backofficeRadarOutboxThroughputUseCase.upsert({
      ...parsed.data,
      updatedByProfileId: access.access.profileId,
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeRadarOutboxThroughputRoute][PATCH]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
