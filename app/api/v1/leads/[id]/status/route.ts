import { NextRequest } from "next/server";
import { handleLeadStatusTransition } from "./handleLeadStatusTransition";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleLeadStatusTransition(request, context, {
    defaultMode: "apply",
    allowBodyMode: false,
    logPrefix: "LeadStatusRoute][PUT",
  });
}
