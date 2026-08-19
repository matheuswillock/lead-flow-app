import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase";
import type { PublicFormSnapshot } from "@/lib/public-forms/types";
import { PublicFormViewProvider } from "./features/context/PublicFormViewContext";
import { PublicFormViewContainer } from "./features/container/PublicFormViewContainer";

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ e2eSlowSnapshot?: string }>;
}) {
  const { publicId } = await params;

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
