import { NextRequest } from "next/server";
import { handleFilterPresetUse } from "@/app/api/v1/teams/[teamId]/filter-presets/handlers";

const SCOPE = "carteira" as const;
const ROUTE_LABEL = "CarteiraFilterPresetUseRoute";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; presetId: string }> }
) {
  return handleFilterPresetUse(request, params, SCOPE, ROUTE_LABEL);
}
