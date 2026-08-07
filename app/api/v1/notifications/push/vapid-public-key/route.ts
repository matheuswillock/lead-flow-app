import { NextResponse, connection } from "next/server";
import { webPushSubscriptionUseCase } from "@/app/api/useCases/notifications/WebPushSubscriptionUseCase";

export async function GET() {
  await connection();

  const output = webPushSubscriptionUseCase.getVapidPublicKey();
  if (!output.isValid) {
    return NextResponse.json(output, { status: 503 });
  }

  return NextResponse.json(output, { status: 200 });
}
