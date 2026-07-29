"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateEditorDraft } from "../context/TemplateEditorTypes";
import { EditorHtmlWorkspace } from "./EditorHtmlWorkspace";
import { EditorSidebar } from "./EditorSidebar";

const SIDEBAR_COLLAPSED_KEY = "email-template-editor-sidebar-collapsed";

type EditorSnapshot = Pick<TemplateEditorDraft, "html" | "mailyJson" | "previewText">;

export interface EmailEditorStudioRef {
  publish: () => Promise<void>;
  saveAndPublish: () => Promise<void>;
  getCurrentSnapshot: () => Promise<EditorSnapshot | null>;
}

export const EmailEditorStudio = forwardRef<
  EmailEditorStudioRef,
  { SidebarComponent?: typeof EditorSidebar }
>(function EmailEditorStudio({ SidebarComponent = EditorSidebar }, ref) {
    const {
      template,
      draft,
      loading,
      saving,
      saveTemplate,
      publishTemplate,
      updateDraft,
      setHtml,
    } = useTemplateEditorContext();

    const [htmlModeValue, setHtmlModeValue] = useState(() => draft.html);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "true") {
        setSidebarCollapsed(true);
      }
    }, []);

    const handleSidebarCollapsedChange = useCallback((collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
      }
    }, []);

    const buildSnapshot = useCallback((): EditorSnapshot => ({
      html: htmlModeValue || draft.html,
      mailyJson: draft.mailyJson,
      previewText: draft.previewText,
    }), [htmlModeValue, draft.html, draft.mailyJson, draft.previewText]);

    const handlePublish = useCallback(async () => {
      if (saving) return;
      const snapshot = buildSnapshot();
      setHtml(snapshot.html);
      await saveTemplate(snapshot);
    }, [buildSnapshot, saveTemplate, saving, setHtml]);

    const handleSaveAndPublish = useCallback(async () => {
      if (saving) return;
      const snapshot = buildSnapshot();
      setHtml(snapshot.html);
      const saved = await saveTemplate(snapshot);
      if (saved) {
        await publishTemplate(saved.id);
      }
    }, [buildSnapshot, publishTemplate, saveTemplate, saving, setHtml]);

    const getCurrentSnapshot = useCallback(async (): Promise<EditorSnapshot | null> => {
      return buildSnapshot();
    }, [buildSnapshot]);

    useImperativeHandle(
      ref,
      () => ({
        publish: handlePublish,
        saveAndPublish: handleSaveAndPublish,
        getCurrentSnapshot,
      }),
      [getCurrentSnapshot, handlePublish, handleSaveAndPublish]
    );

    const handleHtmlModeChange = useCallback(
      (value: string) => {
        setHtmlModeValue(value);
        updateDraft({ html: value });
      },
      [updateDraft]
    );

    return (
      <div className="flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
        <div className="relative flex h-full min-h-0 flex-1 gap-3 overflow-hidden bg-muted/20 p-3">
          <SidebarComponent
            history={template?.history ?? []}
            collapsed={sidebarCollapsed}
            onCollapsedChange={handleSidebarCollapsedChange}
          />

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl">
            <EditorHtmlWorkspace
              ready={!loading}
              remountKey={template?.id}
              value={htmlModeValue || draft.html}
              onChange={handleHtmlModeChange}
            />
          </div>
        </div>
      </div>
    );
  }
);
