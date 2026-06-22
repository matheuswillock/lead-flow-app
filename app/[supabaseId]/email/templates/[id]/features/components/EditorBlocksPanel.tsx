"use client";

import { Code2, ImagePlus, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EditorMode } from "./EditorStudioTypes";

interface EditorBlocksPanelProps {
  editorMode: EditorMode;
  isDirty: boolean;
  eventStatus: string;
  exporting: boolean;
  uploadingImage: boolean;
  onExportHtml: () => void;
  onImportImage: () => void;
  onAddLink: () => void;
}

export function EditorBlocksPanel({
  editorMode,
  isDirty,
  eventStatus,
  exporting,
  uploadingImage,
  onExportHtml,
  onImportImage,
  onAddLink,
}: EditorBlocksPanelProps) {
  const blocksActionsDisabled = editorMode === "html";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={onImportImage}
                disabled={uploadingImage || blocksActionsDisabled}
              >
                {uploadingImage ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ImagePlus data-icon="inline-start" />
                )}
                {uploadingImage ? "Importando..." : "Importar imagem"}
              </Button>
            </span>
          </TooltipTrigger>
          {blocksActionsDisabled ? (
            <TooltipContent>Disponível apenas no modo blocos</TooltipContent>
          ) : null}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={onAddLink}
                disabled={blocksActionsDisabled}
              >
                <Link2 data-icon="inline-start" />
                Link
              </Button>
            </span>
          </TooltipTrigger>
          {blocksActionsDisabled ? (
            <TooltipContent>Disponível apenas no modo blocos</TooltipContent>
          ) : null}
        </Tooltip>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Exportação</h3>
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={onExportHtml}
          disabled={exporting}
        >
          {exporting ? <Spinner data-icon="inline-start" /> : <Code2 data-icon="inline-start" />}
          {exporting ? "Exportando..." : "Exportar HTML"}
        </Button>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Badge variant={isDirty ? "default" : "secondary"}>
          {isDirty ? "Alterado" : "Sincronizado"}
        </Badge>
        <Badge variant="outline">{eventStatus}</Badge>
      </div>
      </div>
    </TooltipProvider>
  );
}
