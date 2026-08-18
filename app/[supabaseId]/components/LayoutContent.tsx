"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserContext } from "@/app/context/UserContext";
import { useTeamContext } from "@/app/context/TeamContext";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { useOperationalAccess } from "@/app/context/OperationalAccessContext";
import { GlobalLoading } from "@/components/global-loading";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { WhatsNewModal } from "@/components/whats-new-modal";
import { Users2 } from "lucide-react";
import { getFeatureSlugsForAppPath, isAssociadosAppPath } from "@/lib/features/feature-route-access"
import { PageBreadcrumbProvider } from "@/app/context/PageBreadcrumbContext"
import { CampaignDispatchIndicator } from "./CampaignDispatchIndicator";
import { TeamSwitchingScreen } from "./TeamSwitchingScreen";

interface LayoutContentProps {
  children: React.ReactNode;
  supabaseId: string;
  defaultOpen: boolean;
}

/**
 * Componente cliente que aguarda o UserContext carregar
 * antes de renderizar o layout completo
 */
export function LayoutContent({ children, supabaseId, defaultOpen }: LayoutContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, error } = useUserContext();
  const {
    teams,
    isLoading: teamsLoading,
    error: teamsError,
    isSwitchingTeam,
    switchingTeamName,
    isTeamSwitchPersisted,
    completeTeamSwitch,
  } = useTeamContext();
  const { isLoading: featureLoading, hasAccess, refresh: refreshFeatureAccess } = useFeatureAccess();
  const { access: operationalAccess, isLoading: operationalAccessLoading, refresh: refreshOperationalAccess } = useOperationalAccess();
  const refreshFeatureAccessRef = useRef(refreshFeatureAccess);
  const refreshOperationalAccessRef = useRef(refreshOperationalAccess);
  refreshFeatureAccessRef.current = refreshFeatureAccess;
  refreshOperationalAccessRef.current = refreshOperationalAccess;

  useEffect(() => {
    if (!isSwitchingTeam || !isTeamSwitchPersisted) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await Promise.all([
          refreshFeatureAccessRef.current(true),
          refreshOperationalAccessRef.current(true),
        ]);
        router.refresh();
      } catch (switchError) {
        console.error("[LayoutContent] Falha ao atualizar dados na troca de time:", switchError);
      } finally {
        if (!cancelled) {
          completeTeamSwitch();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [completeTeamSwitch, isSwitchingTeam, isTeamSwitchPersisted, router]);

  const hasBootstrapData = Boolean(user) && teams.length > 0;
  const isBootstrapping = isLoading || teamsLoading;

  if (isSwitchingTeam) {
    return <TeamSwitchingScreen teamName={switchingTeamName} />;
  }

  if (isBootstrapping && !hasBootstrapData) {
    return <GlobalLoading />;
  }

  // Se houver erro, mostra mensagem de erro
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-6 max-w-md">
          <div className="text-destructive text-5xl">⚠️</div>
          <h2 className="text-xl font-semibold">Erro ao Carregar Dados</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (teamsError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-6 max-w-md">
          <div className="text-destructive text-5xl">⚠️</div>
          <h2 className="text-xl font-semibold">Erro ao Carregar Times</h2>
          <p className="text-sm text-muted-foreground">{teamsError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const shouldShowNoTeamsMessage = teams.length === 0;
  const requiredFeatureSlugs = getFeatureSlugsForAppPath(pathname);
  const isAssociadosRoute = isAssociadosAppPath(pathname);
  const shouldBlockByFeature =
    !shouldShowNoTeamsMessage &&
    !featureLoading &&
    !operationalAccessLoading &&
    ((requiredFeatureSlugs.length > 0 && !requiredFeatureSlugs.some((slug) => hasAccess(slug))) ||
      (isAssociadosRoute && !operationalAccess.associadosQueue));
  const canShowWhatsNewModal = !shouldShowNoTeamsMessage && !shouldBlockByFeature;

  // Dados carregados, renderiza o layout completo
  return (
    <PageBreadcrumbProvider>
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar supabaseId={supabaseId} />
      <SidebarInset>
        <SiteHeader />
        <WhatsNewModal supabaseId={supabaseId} enabled={canShowWhatsNewModal} />
        <CampaignDispatchIndicator />
        <div className="flex min-h-0 flex-1 flex-col h-[calc(100dvh-var(--header-height))] overflow-auto">
          <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
            {shouldShowNoTeamsMessage ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <div className="text-center space-y-3 max-w-md">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40">
                    <Users2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold">Você ainda não faz parte de nenhum time</h2>
                  <p className="text-sm text-muted-foreground">
                    Para usar a plataforma, solicite ao seu manager que inclua você em um time.
                  </p>
                </div>
              </div>
            ) : shouldBlockByFeature ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <div className="text-center space-y-3 max-w-md">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40">
                    <Users2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold">Acesso não liberado</h2>
                  <p className="text-sm text-muted-foreground">
                    Esta funcionalidade não está liberada para o seu usuário no momento.
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </PageBreadcrumbProvider>
  );
}
