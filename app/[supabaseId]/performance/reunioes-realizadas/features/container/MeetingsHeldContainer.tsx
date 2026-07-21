"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext";
import { MeetingsHeldCalendarPanel } from "./components/MeetingsHeldCalendarPanel";
import { MeetingsHeldFiltersBar } from "./components/MeetingsHeldFiltersBar";
import { MeetingsHeldTable } from "./components/MeetingsHeldTable";
import { useMeetingsHeldContext } from "../context/MeetingsHeldContext";

export function MeetingsHeldContainer() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { user } = useUserContext();
  const { activeRole, isTeamMaster } = useTeamContext();
  const { error } = useMeetingsHeldContext();
  const { setOverride } = usePageBreadcrumb();

  const canAccess =
    user?.isMaster === true || isTeamMaster || activeRole === "manager";

  useEffect(() => {
    setOverride({ label: "Reuniões realizadas" });
    return () => setOverride(null);
  }, [setOverride]);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground max-w-md">
          Esta página é exclusiva para managers e master da conta.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/${supabaseId}/performance`}>
            <ArrowLeft data-icon="inline-start" />
            Voltar para Performance
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="bg-grid">
        <div className="px-6 py-6 max-w-370 mx-auto w-full flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-2">
              <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
                <Link href={`/${supabaseId}/performance`}>
                  <ArrowLeft data-icon="inline-start" />
                  Performance
                </Link>
              </Button>
              <div className="flex items-center gap-2.5">
                <CalendarCheck className="size-6 text-primary" />
                <div>
                  <h1 className="font-display text-[26px] font-bold leading-none tracking-tight">
                    Reuniões realizadas
                  </h1>
                  <p className="text-[12.5px] text-foreground/55 mt-1.5">
                    Reuniões marcadas como realizadas no período selecionado
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid w-full min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <MeetingsHeldCalendarPanel />
            <div className="flex flex-col gap-4 min-w-0">
              <div className="rounded-xl border border-border bg-card/40 px-3 py-3">
                <MeetingsHeldFiltersBar />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <MeetingsHeldTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
