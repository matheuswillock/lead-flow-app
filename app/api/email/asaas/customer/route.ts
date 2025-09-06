import { NextResponse } from "next/server"
import { createAsaasCustomer } from "@/lib/asaas"

export async function POST(req: Request) {
  const body = await req.json()
  const data = await createAsaasCustomer(body)
  return NextResponse.json(data)
}
