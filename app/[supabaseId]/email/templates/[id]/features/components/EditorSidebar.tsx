"use client";

import { useMemo } from "react";
import { Braces, ChevronLeft, ChevronRight, Clock3, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractTemplateVariableKeys } from "@/lib/email/interpolate";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateHistoryItem } from "../context/TemplateEditorTypes";
import { EditorBlocksPanel } from "./EditorBlocksPanel";
import { EditorFloatingPanel } from "./EditorFloatingPanel";
import type { EditorMode, SidebarSection } from "./EditorStudioTypes";
import { TemplateHistoryPanel } from "./TemplateHistoryPanel";
import { VariablesPanel } from "./VariablesPanel";

const SECTION_TITLES: Record<Exclude<SidebarSection, "menu">, string> = {
  blocks: "Blocos",
  variables: "Variáveis",
  history: "Histórico",
};

interface EditorSidebarProps {
  editorMode: EditorMode;
  section: SidebarSection;
  history: TemplateHistoryItem[];
  isDirty: boolean;
  eventStatus: string;
  exporting: boolean;
  uploadingImage: boolean;
  onSectionChange: (section: SidebarSection) => void;
  onExportHtml: () => void;
  onImportImage: () => void;
  onAddLink: () => void;
}

export function EditorSidebar({
  editorMode,
  section,
  history,
  isDirty,
  eventStatus,
  exporting,
  uploadingImage,
  onSectionChange,
  onExportHtml,
  onImportImage,
  onAddLink,
}: EditorSidebarProps) {
  const { draft } = useTemplateEditorContext();

  const usedVariableCount = useMemo(() => {
    const keys = extractTemplateVariableKeys(`${draft.subject}\n${draft.html}`);
    return keys.length;
  }, [draft.subject, draft.html]);

  if (section === "menu") {
    return (
      <EditorFloatingPanel width="sidebar" className="overflow-y-auto p-4">
        <h2 className="text-sm font-semibold">Editor</h2>

        <div className="mt-4 flex flex-col gap-2">
          {editorMode === "blocks" ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-between px-3 py-3"
              onClick={() => onSectionChange("blocks")}
            >
              <span className="flex items-center gap-2">
                <LayoutGrid data-icon="inline-start" />
                Blocos
              </span>
              <ChevronRight />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => onSectionChange("variables")}
          >
            <span className="flex items-center gap-2">
              <Braces data-icon="inline-start" />
              Variáveis
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="outline" className="text-muted-foreground">
                {usedVariableCount} {usedVariableCount === 1 ? "usada" : "usadas"}
              </Badge>
              <ChevronRight />
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => onSectionChange("history")}
          >
            <span className="flex items-center gap-2">
              <Clock3 data-icon="inline-start" />
              Histórico
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="outline">{history.length}</Badge>
              <ChevronRight />
            </span>
          </Button>
        </div>
      </EditorFloatingPanel>
    );
  }

  return (
    <EditorFloatingPanel width="sidebar" className="overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b p-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => onSectionChange("menu")}
        >
          <ChevronLeft data-icon="inline-start" />
          Voltar
        </Button>
        <h2 className="text-sm font-semibold">{SECTION_TITLES[section]}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {section === "blocks" ? (
          <EditorBlocksPanel
            editorMode={editorMode}
            isDirty={isDirty}
            eventStatus={eventStatus}
            exporting={exporting}
            uploadingImage={uploadingImage}
            onExportHtml={onExportHtml}
            onImportImage={onImportImage}
            onAddLink={onAddLink}
          />
        ) : null}

        {section === "variables" ? <VariablesPanel embedded /> : null}

        {section === "history" ? <TemplateHistoryPanel history={history} embedded /> : null}
      </div>
    </EditorFloatingPanel>
  );
}
