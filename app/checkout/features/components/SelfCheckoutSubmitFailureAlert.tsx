import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import type { SelfCheckoutSubmitFailure } from "../context/SelfCheckoutTypes"

export function SelfCheckoutSubmitFailureAlert({ failure }: { failure: SelfCheckoutSubmitFailure }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" aria-hidden="true" />
      <AlertDescription>
        {failure.message}
        {failure.code === "ACCOUNT_EXISTS" ? (
          <>
            {" "}
            <Link href="/sign-in" className="font-medium underline underline-offset-4">
              Entrar na sua conta
            </Link>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
