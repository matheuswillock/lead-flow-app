import { NextRequest } from "next/server";
import { handleStudioWebhookLeadRequest } from "../handleStudioWebhookLeadRequest";

const routePrefix = "[StudioWebhookNoTokenRoute][POST]";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const resolvedParams = await params;
  return handleStudioWebhookLeadRequest({
    request,
    routePrefix,
    teamId: resolvedParams.teamId,
  });
}
