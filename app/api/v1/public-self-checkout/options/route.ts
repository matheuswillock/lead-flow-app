import { connection } from "next/server"
import { selfCheckoutUseCase } from "@/app/api/useCases/selfCheckout/selfCheckoutComposition"
import { createSelfCheckoutOptionsHandler } from "../handlers"

const handleGet = createSelfCheckoutOptionsHandler(selfCheckoutUseCase)

/** Ciclos e preços do auto-checkout, lidos do banco a cada pedido (cache de borda <= 15 s). */
export async function GET() {
  await connection()
  return handleGet()
}
