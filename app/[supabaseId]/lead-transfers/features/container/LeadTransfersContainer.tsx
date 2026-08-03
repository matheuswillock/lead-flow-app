"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog";
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes";
import { useUserContext } from "@/app/context/UserContext";
import { useTeamContext } from "@/app/context/TeamContext";
import { isManagerLikeRole } from "@/lib/roles";
import type { FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";
import { toast } from "sonner";
import { useLeadTransfersContext } from "../context/LeadTransfersContext";
import type { LeadTransferRow } from "../context/LeadTransfersTypes";
import { LeadTransfersFiltersBar } from "./LeadTransfersFiltersBar";
import { LeadTransfersTable } from "./LeadTransfersTable";
import { API_CLIENT_BASE } from "@/lib/route-map";

export function LeadTransfersContainer() {
  const { user, isLoading: userLoading } = useUserContext();
  const { activeTeamId } = useTeamContext();
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { data, isLoading, error, refresh } = useLeadTransfersContext();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadLoading, setIsLeadLoading] = useState(false);

  const resolvedIsMaster = user?.isMaster === true;
  const canAccess = resolvedIsMaster || isManagerLikeRole(user?.role);

  const fetchLead = useCallback(
    async (leadId: string) => {
      if (!supabaseId || !activeTeamId) return null;

      const res = await fetch(`${API_CLIENT_BASE}/leads/${leadId}`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      });
      const json = await res.json();
      if (!json.isValid) {
        throw new Error(json.errorMessages?.[0] ?? "Erro ao carregar lead");
      }
      return json.result as Lead;
    },
    [supabaseId, activeTeamId]
  );

  const handleRowClick = useCallback(
    async (row: LeadTransferRow) => {
      setIsLeadLoading(true);
      try {
        const lead = await fetchLead(row.leadId);
        if (!lead) return;
        setSelectedLead(lead);
        setDialogOpen(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao abrir lead";
        toast.error(message);
      } finally {
        setIsLeadLoading(false);
      }
    },
    [fetchLead]
  );

  const handleRefreshLeads = useCallback(async () => {
    await refresh();
    if (selectedLead) {
      try {
        const lead = await fetchLead(selectedLead.id);
        if (lead) setSelectedLead(lead);
      } catch {
        // mantém lead atual em caso de falha silenciosa
      }
    }
  }, [refresh, selectedLead, fetchLead]);

  const noopFinalizeContract = useCallback(
    async (_leadId: string, _data: FinalizeContractData) => {
      return Promise.resolve();
    },
    []
  );

  if (!canAccess) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <ArrowRightLeft className="size-12 text-muted-foreground" />
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">Acesso restrito</h3>
              <p className="text-muted-foreground">
                Apenas Master, Manager ou Backoffice podem visualizar transferências de leads.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ArrowRightLeft className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">Transferências</h1>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {data?.total ?? 0} transferência{(data?.total ?? 0) === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <LeadTransfersFiltersBar />
      </div>

      <LeadTransfersTable onRowClick={handleRowClick} />

      <LeadDialog
        open={dialogOpen}
        setOpen={setDialogOpen}
        lead={selectedLead}
        user={user}
        userLoading={userLoading || isLeadLoading}
        refreshLeads={handleRefreshLeads}
        finalizeContract={noopFinalizeContract}
      />
    </div>
  );
}
