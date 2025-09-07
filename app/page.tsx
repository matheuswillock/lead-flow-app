import Link from "next/link"
import { Button } from "@/components/ui/button"
import LandingPage from "./landingPage"

export default function Home() {
  return (
    // <main className="min-h-screen grid place-items-center p-6">
    //   <div className="text-center space-y-4">
    //     <h1 className="text-3xl font-semibold">Lead Flow</h1>
    //     <p className="text-muted-foreground">Organize seus leads antes do CRM.</p>
    //     <div className="flex items-center justify-center gap-3">
    //       <Button asChild><Link href="/sign-in">Entrar</Link></Button>
    //       <Button variant="secondary" asChild><Link href="/sign-up">Cadastrar</Link></Button>
    //     </div>
    //   </div>
    // </main>

    <LandingPage />
  )
}
