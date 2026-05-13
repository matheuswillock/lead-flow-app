import { Card, CardContent } from "@/components/ui/card";
import { HospitalOptionCard } from "./HospitalOptionCard";
import type { PmeHospitalId, PmeHospitalOption } from "../context/PmeSimulatorTypes";

type HospitalSelectorCardProps = {
  hospitals: PmeHospitalOption[];
  selectedHospitalId: PmeHospitalId;
  onSelectHospital: (hospitalId: PmeHospitalId) => void;
};

export function HospitalSelectorCard({ hospitals, selectedHospitalId, onSelectHospital }: HospitalSelectorCardProps) {
  return (
    <Card className="rounded-2xl border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Hospital de Referencia
        </span>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {hospitals.map((hospital) => (
            <HospitalOptionCard
              key={hospital.id}
              option={hospital}
              isActive={selectedHospitalId === hospital.id}
              onSelect={onSelectHospital}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

