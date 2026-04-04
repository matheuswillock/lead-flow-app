import { NextResponse } from "next/server";
import { Output } from "@/lib/output";

export async function POST() {
  return NextResponse.json(
    new Output(
      false,
      [],
      ["Use /api/webhooks/studio/{teamId}/{token} para enviar eventos deste webhook."],
      null
    ),
    { status: 404 }
  );
}
