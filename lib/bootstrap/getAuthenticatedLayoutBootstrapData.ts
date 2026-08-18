import "server-only";

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { resolveE2eUser } from "@/lib/e2e/resolve-e2e-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getFullUrl } from "@/lib/utils/app-url";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { SubscriptionRepository } from "@/app/api/infra/data/repositories/subscription/SubscriptionRepository";
import { SubscriptionCheckService } from "@/app/api/services/SubscriptionCheck/SubscriptionCheckService";
import { CheckSubscriptionUseCase } from "@/app/api/useCases/subscriptions/CheckSubscriptionUseCase";
import { featureAccessUseCase } from "@/app/api/useCases/featureAccess/FeatureAccessUseCase";
import { meOperationalAccessUseCase } from "@/app/api/useCases/meOperationalAccess/MeOperationalAccessUseCase";
import type { OperationalAccessInitialData } from "@/app/context/OperationalAccessContext";
import { GET as getTeamsRouteHandler } from "@/app/api/v1/teams/route";
import type { UserData } from "@/app/context/UserContext";
import type { TeamSummary } from "@/app/context/TeamContext";
import type { UserRoleData } from "@/app/context/FeatureAccessContext";

export type LayoutFeatureAccessBootstrap = {
  slugs: string[];
  betaSlugs: string[];
  betaLabelSlugs: string[];
  userRole: UserRoleData | null;
  /** Chave usada na resolução server-side — permite ao provider validar o cache. */
  profileId: string;
  teamId: string | null;
};

export type AuthenticatedLayoutBootstrapData = {
  user: UserData;
  /** null quando o check de assinatura falhou — força recheck no cliente. */
  hasActiveSubscription: boolean | null;
  userRole: string | null;
  teams: TeamSummary[] | null;
  activeTeamId: string | null;
  featureAccess: LayoutFeatureAccessBootstrap | null;
  operationalAccess: OperationalAccessInitialData | null;
};

type SubscriptionCheckResult = {
  userExists?: boolean;
  hasActiveSubscription?: boolean;
  userRole?: string | null;
};

const profileUseCase = new RegisterNewUserProfile();

async function fetchTeamsViaRoute(
  supabaseId: string
): Promise<{ teams: TeamSummary[]; activeTeamId: string | null } | null> {
  try {
    // Reusa o handler da rota (fonte única da lógica de listagem de times)
    // sem round-trip HTTP.
    const request = new NextRequest(getFullUrl("/api/v1/teams"), {
      headers: { "x-supabase-user-id": supabaseId },
    });
    const response = await getTeamsRouteHandler(request);
    if (!response.ok) return null;

    const output = await response.json();
    if (!output?.isValid || !output.result) return null;

    return output.result as { teams: TeamSummary[]; activeTeamId: string | null };
  } catch (error) {
    console.error("[LayoutBootstrap] Erro ao resolver times no servidor:", error);
    return null;
  }
}

async function fetchSubscriptionCheck(user: UserData): Promise<SubscriptionCheckResult | null> {
  try {
    const subscriptionRepository = new SubscriptionRepository();
    const subscriptionCheckService = new SubscriptionCheckService(subscriptionRepository);
    const checkSubscriptionUseCase = new CheckSubscriptionUseCase(subscriptionCheckService);

    const output = await checkSubscriptionUseCase.execute({
      email: user.email,
      phone: user.phone ?? undefined,
      cpfCnpj: user.cpfCnpj ?? undefined,
    });

    return output.isValid ? (output.result as SubscriptionCheckResult) : null;
  } catch (error) {
    console.error("[LayoutBootstrap] Erro ao verificar assinatura no servidor:", error);
    return null;
  }
}

async function fetchFeatureAccess(
  user: UserData,
  activeTeamId: string | null,
  managerId: string
): Promise<LayoutFeatureAccessBootstrap | null> {
  try {
    const output = await featureAccessUseCase.execute({
      profileId: user.id,
      managerId,
      activeTeamId,
    });

    if (!output.isValid || !output.result) return null;

    const result = output.result as {
      slugs: string[];
      betaSlugs: string[];
      betaLabelSlugs: string[];
      userRole: UserRoleData | null;
    };

    return {
      slugs: result.slugs ?? [],
      betaSlugs: result.betaSlugs ?? [],
      betaLabelSlugs: result.betaLabelSlugs ?? [],
      userRole: result.userRole ?? null,
      profileId: user.id,
      teamId: activeTeamId,
    };
  } catch (error) {
    console.error("[LayoutBootstrap] Erro ao resolver feature access no servidor:", error);
    return null;
  }
}

/**
 * Bootstrap server-side do layout autenticado: resolve user + teams + feature
 * access no servidor para hidratar os providers com initialData, eliminando a
 * cascata de fetches client-side que bloqueava o primeiro paint.
 *
 * Retorna null quando a sessão não corresponde ao supabaseId da rota — nesse
 * caso os providers seguem o fluxo client-side existente.
 */
export async function getAuthenticatedLayoutBootstrapData(
  supabaseId: string
): Promise<AuthenticatedLayoutBootstrapData | null> {
  try {
    const cookieStore = await cookies();
    const e2eUser = await resolveE2eUser((name) => cookieStore.get(name)?.value);

    let sessionUserId: string | null = null;
    if (e2eUser) {
      console.info("[E2E] Bootstrap autenticado via cookie assinado", {
        userId: e2eUser.id,
      });
      sessionUserId = e2eUser.id;
    } else {
      const supabase = await createSupabaseServer();
      if (!supabase) return null;

      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();
      sessionUserId = sessionUser?.id ?? null;
    }

    // Guarda de propriedade: o supabaseId da URL precisa ser o da sessão.
    if (!sessionUserId || sessionUserId !== supabaseId) return null;

    const [profileOutput, teamsPayload] = await Promise.all([
      profileUseCase.getProfileBySupabaseId(supabaseId),
      fetchTeamsViaRoute(supabaseId),
    ]);

    if (!profileOutput.isValid || !profileOutput.result) return null;
    const user = profileOutput.result as UserData;

    const activeTeamId = teamsPayload?.activeTeamId ?? user.activeTeamId ?? null;
    const activeTeam = teamsPayload?.teams.find((team) => team.id === activeTeamId) ?? null;
    const managerId = activeTeam?.masterId ?? user.managerId ?? user.id;

    const [subscriptionCheck, featureAccess, operationalAccessResult] = await Promise.all([
      fetchSubscriptionCheck(user),
      fetchFeatureAccess(user, activeTeamId, managerId),
      meOperationalAccessUseCase.resolve(user.id, activeTeamId).then((output) =>
        output.isValid && output.result
          ? {
              ...(output.result as {
                associadosQueue: boolean;
                multiskillTransferOrigin: boolean;
                multiskillExternalTransfer: boolean;
              }),
              profileId: user.id,
              teamId: activeTeamId,
            }
          : null
      ),
    ]);

    return {
      user,
      hasActiveSubscription: subscriptionCheck
        ? !!subscriptionCheck.hasActiveSubscription
        : null,
      userRole: subscriptionCheck?.userRole ?? null,
      teams: teamsPayload?.teams ?? null,
      activeTeamId,
      featureAccess,
      operationalAccess: operationalAccessResult,
    };
  } catch (error) {
    console.error("[LayoutBootstrap] Erro no bootstrap server-side:", error);
    return null;
  }
}
