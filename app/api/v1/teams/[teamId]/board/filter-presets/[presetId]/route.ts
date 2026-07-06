import { NextRequest } from "next/server";
import {
  handleFilterPresetDelete,
  handleFilterPresetUpdate,
} from "@/app/api/v1/teams/[teamId]/filter-presets/handlers";

const SCOPE = "board" as const;
const ROUTE_LABEL = "BoardFilterPresetByIdRoute";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; presetId: string }> }
) {
  return handleFilterPresetUpdate(request, params, SCOPE, ROUTE_LABEL);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; presetId: string }> }
) {
  return handleFilterPresetDelete(request, params, SCOPE, ROUTE_LABEL);
}
