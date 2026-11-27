import { connection, type NextRequest } from "next/server";
import { handleBethaniaAgendaCron } from "@/app/api/useCases/bethania-outbox/BethaniaAgendaCronComposition";

export async function GET(request: NextRequest) {
  await connection();
  return handleBethaniaAgendaCron(request);
}
