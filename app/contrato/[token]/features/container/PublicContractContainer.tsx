"use client"

import { FileText, Download, Loader2, TriangleAlert } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicContract } from "../context/PublicContractHook"

function formatExpiresAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

export function PublicContractContainer() {
  const { share, isLoading, isDownloading, error, downloadContract } = usePublicContract()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        {isLoading ? (
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : error || !share ? (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert data-icon="inline-start" className="text-destructive" />
                Link indisponível
              </CardTitle>
              <CardDescription>
                {error ?? "Não foi possível carregar este contrato."}
              </CardDescription>
            </CardHeader>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText data-icon="inline-start" />
                {share.contractTitle}
              </CardTitle>
              <CardDescription>
                Versão {share.versionNumber} · {share.fileName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Este link expira em {formatExpiresAt(share.expiresAt)}.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                className="w-full"
                disabled={isDownloading}
                onClick={() => void downloadContract()}
              >
                {isDownloading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download data-icon="inline-start" />
                )}
                Baixar contrato
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </main>
  )
}
