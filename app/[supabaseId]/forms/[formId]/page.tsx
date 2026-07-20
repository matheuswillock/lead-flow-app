import { PublicFormEditProvider } from "./features/context/PublicFormEditContext"
import { PublicFormEditContainer } from "./features/container/PublicFormEditContainer"

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  return (
    <PublicFormEditProvider formId={formId}>
      <PublicFormEditContainer />
    </PublicFormEditProvider>
  )
}
