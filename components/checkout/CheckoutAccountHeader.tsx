import Image from "next/image"
import { LogOut } from "lucide-react"

import { signout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

/** Cabeçalho dos checkouts logados (fora do shell da conta): identidade do produto e saída da sessão. */
export function CheckoutAccountHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <Image src="/corretor-studio-icon.svg" alt="" width={28} height={28} priority />
        <span className="truncate font-display text-sm font-semibold text-foreground">Corretor Studio</span>
      </div>
      <form action={signout}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut data-icon="inline-start" aria-hidden />
          Sair
        </Button>
      </form>
    </header>
  )
}
