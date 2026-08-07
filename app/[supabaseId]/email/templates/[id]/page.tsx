import { EditorContainer } from "./features/container/EditorContainer";
import { TemplateEditorProvider } from "./features/context/TemplateEditorContext";

type Props = { params: Promise<{ supabaseId: string; id: string }> };

export default async function TemplateEditorPage({ params }: Props) {
  const { supabaseId, id } = await params;

  return (
    <TemplateEditorProvider key={id} supabaseId={supabaseId} templateId={id}>
      <EditorContainer />
    </TemplateEditorProvider>
  );
}
