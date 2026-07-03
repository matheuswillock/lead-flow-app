import type { Metadata } from "next"
import { cookies } from "next/headers"
import { UserProvider } from "@/app/context/UserContext"
import { TeamProvider } from "@/app/context/TeamContext"
import { FeatureAccessProvider } from "@/app/context/FeatureAccessContext"
import { LayoutContent } from "./components/LayoutContent"
import { NotificationsProvider } from "./notifications/features/context/NotificationsContext"
import { InAppNotificationProvider } from "./notifications/features/context/InAppNotificationContext"
import { NotificationFaviconBadge } from "./notifications/features/components/NotificationFaviconBadge"
import { WebPushConsentPrompt } from "./notifications/features/components/WebPushConsentPrompt"
import { NO_INDEX_METADATA } from "@/lib/metadata/policies"
import { getAuthenticatedLayoutBootstrapData } from "@/lib/bootstrap/getAuthenticatedLayoutBootstrapData"

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

  // Bootstrap server-side: user + teams + access resolvidos no servidor para
  // hidratar os providers sem a cascata de fetches client-side. Se falhar
  // (ex.: sessão divergente), os providers seguem o fluxo client-side.
  const bootstrap = await getAuthenticatedLayoutBootstrapData(supabaseId)

  return (
    <UserProvider
      supabaseId={supabaseId}
      initialUser={bootstrap?.user ?? null}
      initialHasActiveSubscription={bootstrap?.hasActiveSubscription ?? null}
      initialUserRole={bootstrap?.userRole ?? null}
    >
      <TeamProvider
        supabaseId={supabaseId}
        initialTeams={bootstrap?.teams ?? null}
        initialActiveTeamId={bootstrap?.activeTeamId ?? null}
      >
        <FeatureAccessProvider initialAccess={bootstrap?.featureAccess ?? null}>
          <NotificationsProvider supabaseId={supabaseId}>
            <InAppNotificationProvider>
              <NotificationFaviconBadge />
              <WebPushConsentPrompt supabaseId={supabaseId} />
              <LayoutContent supabaseId={supabaseId} defaultOpen={defaultOpen}>
                {children}
              </LayoutContent>
            </InAppNotificationProvider>
          </NotificationsProvider>
        </FeatureAccessProvider>
      </TeamProvider>
    </UserProvider>
  )
}
