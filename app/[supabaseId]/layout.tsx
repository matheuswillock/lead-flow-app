import { cookies } from "next/headers"
import { UserProvider } from "@/app/context/UserContext"
import { LayoutContent } from "./components/LayoutContent"

interface ProtectedLayoutProps {
  children: React.ReactNode
  params: Promise<{ supabaseId: string }>
}

/**
 * Layout protegido que requer autenticação
 * Fornece UserContext para todos os componentes filhos
 * Mostra loading global até que os dados do usuário estejam carregados
 */
export default async function ProtectedLayout({ children, params }: ProtectedLayoutProps) {
  const { supabaseId } = await params
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"
  
  return (
    <UserProvider supabaseId={supabaseId}>
      <LayoutContent supabaseId={supabaseId} defaultOpen={defaultOpen}>
        {children}
      </LayoutContent>
    </UserProvider>
  )
}
