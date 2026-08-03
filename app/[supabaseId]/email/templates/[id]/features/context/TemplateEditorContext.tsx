"use client";

import { ReactNode } from "react";
import {
  TemplateEditorStudioContext,
  useTemplateEditorStudioContext,
  type ITemplateEditorStudioContext,
} from "@/components/email/template-editor/TemplateEditorStudioContext";
import { useTemplateEditor } from "./TemplateEditorHook";

interface TemplateEditorProviderProps {
  children: ReactNode;
  supabaseId: string;
  templateId: string;
}

export function TemplateEditorProvider({
  children,
  supabaseId,
  templateId,
}: TemplateEditorProviderProps) {
  const value = useTemplateEditor(supabaseId, templateId);

  return (
    <TemplateEditorStudioContext.Provider value={value}>
      {children}
    </TemplateEditorStudioContext.Provider>
  );
}

export function useTemplateEditorContext(): ITemplateEditorStudioContext {
  return useTemplateEditorStudioContext();
}
