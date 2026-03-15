"use client";

import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BoardProvider } from "@/app/[supabaseId]/board/features/context/BoardContext";
import { BoardContainer } from "@/app/[supabaseId]/board/features/container/BoardContainer";
import { PipelineProvider } from "@/app/[supabaseId]/pipeline/features/context/PipelineContext";
import { PipelineContainer } from "@/app/[supabaseId]/pipeline/features/container/PipelineContainer";
import useCrmContext from "../context/CrmHook";
import { CrmFiltersBar } from "./CrmFiltersBar";

function CrmViewModeSwitch() {
  const { viewMode, setViewMode } = useCrmContext();
  const isKanban = viewMode === "kanban";

  return (
    <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 px-3">
      <span
        className={cn(
          "text-xs font-medium",
          isKanban ? "text-muted-foreground" : "text-foreground"
        )}
      >
        Pipeline
      </span>
      <Switch
        checked={isKanban}
        onCheckedChange={(checked) => setViewMode(checked ? "kanban" : "pipeline")}
        aria-label="Alternar visualização do CRM"
      />
      <span
        className={cn(
          "text-xs font-medium",
          isKanban ? "text-foreground" : "text-muted-foreground"
        )}
      >
        Kanban
      </span>
    </div>
  );
}

export function CrmContainer() {
  const { viewMode, isReady, crmFilters } = useCrmContext();

  if (!isReady) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  const viewModeSwitch = <CrmViewModeSwitch />;
  const filtersBar = <CrmFiltersBar />;

  if (viewMode === "kanban") {
    return (
      <BoardProvider externalFilters={crmFilters}>
        <BoardContainer
          title="CRM"
          viewModeToggle={viewModeSwitch}
          filtersBar={filtersBar}
        />
      </BoardProvider>
    );
  }

  return (
    <PipelineProvider externalFilters={crmFilters}>
      <PipelineContainer
        title="CRM"
        viewModeToggle={viewModeSwitch}
        filtersBar={filtersBar}
        useExternalFilters
      />
    </PipelineProvider>
  );
}
