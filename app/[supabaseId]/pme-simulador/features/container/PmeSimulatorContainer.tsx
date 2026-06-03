"use client";

import { Loader2, ReceiptText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTotalBeneficiaries } from "@/lib/ageRanges";
import { BeneficiariesCard } from "../components/BeneficiariesCard";
import { HospitalSelectorCard } from "../components/HospitalSelectorCard";
import { PmeSimulatorHeader } from "../components/PmeSimulatorHeader";
import { SimulationResults } from "../components/SimulationResults";
import { usePmeSimulatorContext } from "../context/PmeSimulatorContext";

const HOSPITAL_LABELS: Record<string, string> = {
  nenhum: "Sem Hospital",
  sirio: "Sírio-Libanês",
  einstein: "Albert Einstein",
  rededor: "Rede D'Or",
};

export function PmeSimulatorContainer() {
  const {
    isCatalogLoading,
    isSimulationLoading,
    isAllowed,
    error,
    catalogs,
    ageRangeCounts,
    serializedAgeRanges,
    selectedHospitalId,
    simulation,
    expandedPlanIds,
    totalFaixas,
    setSerializedAgeRanges,
    selectHospital,
    runSimulation,
    togglePlan,
  } = usePmeSimulatorContext();

  if (!isAllowed) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Alert className="max-w-xl border-semantic-warning-border bg-semantic-warning-surface">
          <AlertTitle className="text-semantic-warning">Acesso restrito</AlertTitle>
          <AlertDescription className="text-foreground">
            O Simulador de Planos esta disponível apenas para SDR, Closer e perfis manager.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalLives = getTotalBeneficiaries(ageRangeCounts);
  const hospitalLabel =
    catalogs?.hospitals.find((h) => h.id === selectedHospitalId)?.label ??
    HOSPITAL_LABELS[selectedHospitalId] ??
    "Sem Hospital";

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex w-full flex-1 flex-col gap-5 px-4 py-8 lg:px-6">
        <PmeSimulatorHeader />

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="p-6">
              <BeneficiariesCard
                serializedAgeRanges={serializedAgeRanges}
                isLoading={isSimulationLoading}
                onAgeRangesChange={setSerializedAgeRanges}
              />
            </div>

            <Separator />

            <div className="p-6">
              <HospitalSelectorCard
                hospitals={catalogs?.hospitals ?? []}
                selectedHospitalId={selectedHospitalId}
                onSelectHospital={selectHospital}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xl font-bold">{totalLives}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Vidas</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-xl font-bold">{totalFaixas}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Faixas</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-col">
                  <span className="text-base font-bold leading-tight">{hospitalLabel}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Hospital</span>
                </div>
              </div>

              <Button
                size="lg"
                disabled={totalLives === 0 || isSimulationLoading}
                onClick={() => void runSimulation()}
              >
                {isSimulationLoading ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <ReceiptText data-icon="inline-start" />
                )}
                Simular planos
              </Button>
            </div>
          </CardContent>
        </Card>

        <SimulationResults
          agesCount={totalLives}
          simulation={simulation}
          isLoading={isCatalogLoading || isSimulationLoading}
          expandedPlanIds={expandedPlanIds}
          onTogglePlan={togglePlan}
        />
      </div>
    </main>
  );
}
