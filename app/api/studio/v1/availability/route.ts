import { NextRequest } from "next/server";
import { apiStudioAvailabilityUseCase } from "@/app/api/useCases/apiStudio/apiStudioAvailabilityInstance";
import { handleAvailabilityRequest } from "./handleAvailabilityRequest";

export async function GET(request: NextRequest) {
  return handleAvailabilityRequest(request, { useCase: apiStudioAvailabilityUseCase });
}
