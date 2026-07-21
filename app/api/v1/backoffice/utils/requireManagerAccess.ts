import { Output } from "@/lib/output"
import { NextResponse } from "next/server"
import type { BackofficeAccess } from "./getBackofficeAccess"

export function requireManagerAccess(access: BackofficeAccess): NextResponse | null {
  if (access.isOperator) {
    return NextResponse.json(
      new Output(false, [], ["Operators não têm permissão para realizar esta ação"], null),
      { status: 403 }
    )
  }
  return null
}
