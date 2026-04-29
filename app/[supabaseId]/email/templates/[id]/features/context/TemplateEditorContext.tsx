"use client";

import { createContext, ReactNode, useContext } from "react";
import type { Template, TemplateEditorDraft, TemplateEditorState } from "./TemplateEditorTypes";
import { useTemplateEditor } from "./TemplateEditorHook";

interface ITemplateEditorContext extends TemplateEditorState {
  reloadTemplate: () => Promise<void>;
  saveTemplate: (patch?: Partial<TemplateEditorDraft>) => Promise<Template | null>;
  updateDraft: (patch: Partial<TemplateEditorDraft>) => void;
  setMailyJson: (json: unknown) => void;
  setHtml: (html: string) => void;
}

const TemplateEditorContext = createContext<ITemplateEditorContext | undefined>(undefined);

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
    <TemplateEditorContext.Provider value={value}>
      {children}
    </TemplateEditorContext.Provider>
  );
}

export function useTemplateEditorContext(): ITemplateEditorContext {
  const context = useContext(TemplateEditorContext);
  if (!context) {
    throw new Error("useTemplateEditorContext must be used within a TemplateEditorProvider");
  }
  return context;
}
