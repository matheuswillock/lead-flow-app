"use client";

import { useMemo, useState } from "react";
import { Braces, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractTemplateVariableKeys } from "@/lib/email/interpolate";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateHistoryItem } from "../context/TemplateEditorTypes";
import { EditorFloatingPanel } from "./EditorFloatingPanel";
import type { SidebarSection } from "./EditorStudioTypes";
import { TemplateHistoryPanel } from "./TemplateHistoryPanel";
import { VariablesPanel } from "./VariablesPanel";

const SECTION_TITLES: Record<Exclude<SidebarSection, "menu">, string> = {
  variables: "Variáveis",
  history: "Histórico",
};

interface EditorSidebarProps {
  history: TemplateHistoryItem[];
}

export function EditorSidebar({ history }: EditorSidebarProps) {
  const { draft } = useTemplateEditorContext();

  const [section, setSection] = useState<SidebarSection>("menu");

  const usedVariableCount = useMemo(() => {
    const keys = extractTemplateVariableKeys(`${draft.subject}\n${draft.html}`);
    return keys.length;
  }, [draft.subject, draft.html]);

  if (section === "menu") {
    return (
      <EditorFloatingPanel width="sidebar" className="overflow-y-auto p-4">
        <h2 className="text-sm font-semibold">Editor</h2>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => setSection("variables")}
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
            onClick={() => setSection("history")}
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
          onClick={() => setSection("menu")}
        >
          <ChevronLeft data-icon="inline-start" />
          Voltar
        </Button>
        <h2 className="text-sm font-semibold">{SECTION_TITLES[section]}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {section === "variables" ? <VariablesPanel embedded /> : null}
        {section === "history" ? <TemplateHistoryPanel history={history} embedded /> : null}
      </div>
    </EditorFloatingPanel>
  );
}
