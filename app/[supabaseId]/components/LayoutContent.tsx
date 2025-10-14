"use client";

import { useUserContext } from "@/app/context/UserContext";
import { GlobalLoading } from "@/components/global-loading";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

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
  const { isLoading, error } = useUserContext();

  // Enquanto carrega os dados do usuário, mostra loading global
  if (isLoading) {
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

  // Dados carregados, renderiza o layout completo
  return (
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
        <div className="flex min-h-0 flex-1 flex-col h-[calc(100dvh-var(--header-height))] overflow-auto">
          <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
