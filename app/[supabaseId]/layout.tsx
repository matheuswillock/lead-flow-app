import type { Metadata } from "next"
import { cookies } from "next/headers"
import { UserProvider } from "@/app/context/UserContext"
import { TeamProvider } from "@/app/context/TeamContext"
import { FeatureAccessProvider } from "@/app/context/FeatureAccessContext"
import { LayoutContent } from "./components/LayoutContent"
import { NotificationsProvider } from "./notifications/features/context/NotificationsContext"
import { NO_INDEX_METADATA } from "@/lib/metadata/policies"

export const metadata: Metadata = NO_INDEX_METADATA

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
      <TeamProvider supabaseId={supabaseId}>
        <FeatureAccessProvider>
          <NotificationsProvider supabaseId={supabaseId}>
            <LayoutContent supabaseId={supabaseId} defaultOpen={defaultOpen}>
              {children}
            </LayoutContent>
          </NotificationsProvider>
        </FeatureAccessProvider>
      </TeamProvider>
    </UserProvider>
  )
}
