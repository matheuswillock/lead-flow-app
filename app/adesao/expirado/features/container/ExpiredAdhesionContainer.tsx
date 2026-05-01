"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useExpiredAdhesion } from "../context/ExpiredAdhesionHook"

export function ExpiredAdhesionContainer() {
  const { viewState } = useExpiredAdhesion()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-muted">
            <AlertTriangle data-icon="inline-start" />
          </div>
          <CardTitle>{viewState.title}</CardTitle>
          <CardDescription>{viewState.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/">Voltar para o site</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
