"use client"

import Image from "next/image"
import { Mail } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeEmailUnsubscribeContext } from "../context/BackofficeEmailUnsubscribeContext"

export function BackofficeEmailUnsubscribeContainer() {
  const { loading, confirming, info, completed, error, handleConfirm } =
    useBackofficeEmailUnsubscribeContext()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex justify-center">
          <Image src="/corretor-studio-icon.svg" alt="Corretor Studio" width={48} height={48} priority />
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="gap-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Mail data-icon="inline-start" />
            </div>
            <CardTitle className="text-xl">
              {completed ? "Descadastro confirmado" : "Descadastrar de e-mails"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : completed ? (
              <Alert>
                <AlertDescription>
                  Pronto. Você não receberá mais estes e-mails.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Você ({info?.maskedEmail}) deixará de receber estes e-mails.
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={confirming}
                  onClick={() => void handleConfirm()}
                >
                  {confirming ? "Confirmando..." : "Confirmar descadastro"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
