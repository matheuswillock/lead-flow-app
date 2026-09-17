import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase";
import type { PublicFormSnapshot } from "@/lib/public-forms/types";
import { classifyFormsHost, normalizeHostname } from "@/lib/proxy/forms-host";
import {
  findPublicFormTeamId,
  resolveVerifiedTeamFormDomainSafely,
} from "@/lib/public-forms/team-form-domain-tenancy";
import { PublicFormViewProvider } from "./features/context/PublicFormViewContext";
import { PublicFormViewContainer } from "./features/container/PublicFormViewContainer";

/**
 * Guarda de tenancy do serving multi-tenant: em host custom (domínio de
 * formulários de um time), só serve formulário do próprio time. Sem isso, o
 * time A serviria formulário do time B no domínio dele (phishing entre
 * tenants). Host da plataforma e host neutro de fallback servem qualquer time.
 */
async function assertFormBelongsToRequestHost(publicId: string): Promise<void> {
  const headerList = await headers();
  const rawHost = headerList.get("host");
  if (classifyFormsHost(rawHost) !== "custom") return;

  const hostname = normalizeHostname(rawHost);
  if (!hostname) notFound();

  const domain = await resolveVerifiedTeamFormDomainSafely(hostname);
  if (!domain) notFound();

  const formTeamId = await findPublicFormTeamId(publicId);
  if (!formTeamId || formTeamId !== domain.teamId) notFound();
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ e2eSlowSnapshot?: string }>;
}) {
  const { publicId } = await params;

  await assertFormBelongsToRequestHost(publicId);

  // Delay artificial só pra testar o fallback de loading.tsx (Suspense
  // streaming) em E2E: sem carga real, a query resolve rápido demais pro
  // React chegar a emitir o Skeleton no stream antes do conteúdo final.
  // Duplo gate (env de teste + query param explícito) — impossível em produção.
  if (process.env.E2E_TEST_MODE === "true") {
    const { e2eSlowSnapshot } = await searchParams;
    if (e2eSlowSnapshot === "1") {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }

  const output = await publicFormsUseCase.getPublic(publicId);
  const initialSnapshot: PublicFormSnapshot | null =
    output.isValid && output.result
      ? (output.result as { snapshot: PublicFormSnapshot }).snapshot
      : null;

  return (
    <PublicFormViewProvider publicId={publicId} initialSnapshot={initialSnapshot}>
      <PublicFormViewContainer />
    </PublicFormViewProvider>
  );
}
