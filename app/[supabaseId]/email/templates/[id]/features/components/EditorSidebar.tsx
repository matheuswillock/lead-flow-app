"use client";

import { useMemo, useState } from "react";
import { Braces, ChevronLeft, ChevronRight, ClipboardList, Clock3, ImageIcon, Lightbulb, PanelLeftClose, PanelLeftOpen, Video, AtSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { extractTemplateVariableKeys } from "@/lib/email/interpolate";
import { useTemplateEditorContext } from "../context/TemplateEditorContext";
import type { TemplateHistoryItem } from "../context/TemplateEditorTypes";
import { analyzeEmailHtml } from "../utils/analyze-email-html";
import { EditorFloatingPanel } from "./EditorFloatingPanel";
import type { SidebarSection } from "./EditorStudioTypes";
import { EmailCreationTipsPanel } from "./EmailCreationTipsPanel";
import { EmailTemplateAssetsPanel } from "./EmailTemplateAssetsPanel";
import { EmailTemplateFormsPanel } from "./EmailTemplateFormsPanel";
import { EmailTemplateVideosPanel } from "./EmailTemplateVideosPanel";
import { EmailTemplateXPostPanel } from "./EmailTemplateXPostPanel";
import { TemplateHistoryPanel } from "./TemplateHistoryPanel";
import { VariablesPanel } from "./VariablesPanel";
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host";

const SECTION_TITLES: Record<Exclude<SidebarSection, "menu">, string> = {
  variables: "Variáveis",
  history: "Histórico",
  tips: "Dicas",
  assets: "Imagens",
  videos: "Vídeos",
  "x-post": "Post do X",
  forms: "Formulários",
};

interface EditorSidebarProps {
  history: TemplateHistoryItem[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function EditorSidebar({ history, collapsed, onCollapsedChange }: EditorSidebarProps) {
  const { draft, versions, restoringVersionId, restoreTemplateVersion } = useTemplateEditorContext();
  const host = useOptionalStudioEmailHost();
  const isStudioHost = Boolean(host);

  const [section, setSection] = useState<SidebarSection>("menu");

  const usedVariableCount = useMemo(() => {
    const keys = extractTemplateVariableKeys(`${draft.subject}\n${draft.html}`);
    return keys.length;
  }, [draft.subject, draft.html]);

  const tipsAlertCount = useMemo(() => analyzeEmailHtml(draft.html).length, [draft.html]);

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={200}>
        <aside
          className={cn(
            "flex max-h-full min-h-0 w-12 shrink-0 flex-col items-center gap-2 overflow-hidden rounded-xl border bg-card py-3 shadow-md transition-[width]"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onCollapsedChange(false)}
                aria-label="Expandir painel do editor"
              >
                <PanelLeftOpen />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir editor</TooltipContent>
          </Tooltip>
        </aside>
      </TooltipProvider>
    );
  }

  if (section === "menu") {
    return (
      <EditorFloatingPanel width="sidebar" className="overflow-y-auto p-4 transition-[width]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Editor</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onCollapsedChange(true)}
            aria-label="Recolher painel do editor"
          >
            <PanelLeftClose />
          </Button>
        </div>

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
              <Badge variant="outline">{versions.length}</Badge>
              <ChevronRight />
            </span>
          </Button>

          {!isStudioHost ? (
            <>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => setSection("assets")}
          >
            <span className="flex items-center gap-2">
              <ImageIcon data-icon="inline-start" />
              Imagens
            </span>
            <ChevronRight />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => setSection("videos")}
          >
            <span className="flex items-center gap-2">
              <Video data-icon="inline-start" />
              Vídeos
            </span>
            <ChevronRight />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => setSection("x-post")}
          >
            <span className="flex items-center gap-2">
              <AtSign data-icon="inline-start" />
              Post do X
            </span>
            <ChevronRight />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => setSection("forms")}
          >
            <span className="flex items-center gap-2">
              <ClipboardList data-icon="inline-start" />
              Formulários
            </span>
            <ChevronRight />
          </Button>
            </>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-between px-3 py-3"
            onClick={() => setSection("tips")}
          >
            <span className="flex items-center gap-2">
              <Lightbulb data-icon="inline-start" />
              Dicas
            </span>
            <span className="flex items-center gap-2">
              {tipsAlertCount > 0 ? (
                <Badge variant="outline" className="border-warning/40 text-warning">
                  {tipsAlertCount}
                </Badge>
              ) : null}
              <ChevronRight />
            </span>
          </Button>
        </div>
      </EditorFloatingPanel>
    );
  }

  return (
    <EditorFloatingPanel width="sidebar" className="overflow-hidden transition-[width]">
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
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{SECTION_TITLES[section]}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => onCollapsedChange(true)}
          aria-label="Recolher painel do editor"
        >
          <PanelLeftClose />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {section === "variables" ? <VariablesPanel embedded /> : null}
        {section === "history" ? (
          <TemplateHistoryPanel
            versions={versions}
            history={history}
            restoringVersionId={restoringVersionId}
            onRestoreVersion={restoreTemplateVersion}
            embedded
          />
        ) : null}
        {section === "tips" ? <EmailCreationTipsPanel embedded /> : null}
        {section === "assets" ? <EmailTemplateAssetsPanel embedded /> : null}
        {section === "videos" ? <EmailTemplateVideosPanel embedded /> : null}
        {section === "x-post" ? <EmailTemplateXPostPanel embedded /> : null}
        {section === "forms" ? <EmailTemplateFormsPanel embedded /> : null}
      </div>
    </EditorFloatingPanel>
  );
}
