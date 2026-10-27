import { NextRequest } from "next/server";
import { handleStudioWebhookV2Request } from "../handleStudioWebhookV2Request";

/** Webhook de entrada v2 (SPEC 11). A versão gravada no webhook decide; ver `version_mismatch`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return handleStudioWebhookV2Request(request, teamId);
}
