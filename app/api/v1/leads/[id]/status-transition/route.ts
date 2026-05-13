import { NextRequest } from "next/server";
import { handleLeadStatusTransition } from "../status/route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleLeadStatusTransition(request, context, {
    defaultMode: "apply",
    allowBodyMode: true,
    logPrefix: "LeadStatusTransitionRoute][POST",
  });
}
