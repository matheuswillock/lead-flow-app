"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

type ReadOnlyRedirectProps = {
  href: string
}

/** Rota fora do que o modo somente leitura permite: nada é exibido, a pessoa volta ao CRM. */
export function ReadOnlyRedirect({ href }: ReadOnlyRedirectProps) {
  const router = useRouter()

  useEffect(() => {
    router.replace(href)
  }, [href, router])

  return (
    <p
      role="status"
      data-testid="read-only-redirect"
      data-href={href}
      className="p-4 text-sm text-muted-foreground"
    >
      Abrindo o CRM...
    </p>
  )
}
