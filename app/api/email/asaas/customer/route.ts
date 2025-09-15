import { NextResponse } from "next/server"
import { createAsaasCustomer } from "@/lib/asaas"
import { Output } from "@/lib/output"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = await createAsaasCustomer(body)
    const output = new Output(true, ["Customer created successfully"], [], data);
    return NextResponse.json(output, { status: 200 })
  } catch (error: any) {
    const output = new Output(false, [], [error.message || "Failed to create customer"], null);
    return NextResponse.json(output, { status: 500 })
  }
}
