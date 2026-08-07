import { NextRequest, connection } from "next/server";
import {
  handleFilterPresetsCreate,
  handleFilterPresetsList,
} from "@/app/api/v1/teams/[teamId]/filter-presets/handlers";

const SCOPE = "board" as const;
const ROUTE_LABEL = "BoardFilterPresetsRoute";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  await connection();

  return handleFilterPresetsList(request, params, SCOPE, ROUTE_LABEL);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return handleFilterPresetsCreate(request, params, SCOPE, ROUTE_LABEL);
}
