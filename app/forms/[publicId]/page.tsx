import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase";
import type { PublicFormSnapshot } from "@/lib/public-forms/types";
import { PublicFormViewProvider } from "./features/context/PublicFormViewContext";
import { PublicFormViewContainer } from "./features/container/PublicFormViewContainer";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

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
