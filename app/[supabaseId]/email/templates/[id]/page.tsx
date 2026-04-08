import { TemplateEditorProvider } from './features/context/TemplateEditorContext'
import { TemplateEditorContainer } from './features/container/TemplateEditorContainer'

type Props = { params: Promise<{ supabaseId: string; id: string }> }

export default async function TemplateEditorPage({ params }: Props) {
  const { supabaseId, id } = await params
  return (
    <TemplateEditorProvider supabaseId={supabaseId} templateId={id}>
      <TemplateEditorContainer />
    </TemplateEditorProvider>
  )
}
