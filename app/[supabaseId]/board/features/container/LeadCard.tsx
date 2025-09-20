import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "../context/BoardContext";
import { Lead, ColumnKey } from "./BoardTypes";

interface LeadCardProps {
    lead: Lead;
    columnKey: ColumnKey;
    handleCardMouseDown: () => void;
    handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
    handleCardClick: (lead: Lead) => void;
}

export function LeadCard({
    lead,
    columnKey,
    handleCardMouseDown,
    handleCardDragStart,
    handleCardClick,
}: LeadCardProps) {
    return (
        <Card
            key={lead.id}
            draggable
            onMouseDown={handleCardMouseDown}
            onDragStart={(e) => handleCardDragStart(e, lead.id, columnKey)}
            onClick={() => handleCardClick(lead)}
            className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-accent"
        >
            <CardHeader className="py-3">
                <CardTitle className="text-base font-semibold leading-tight">
                    {lead.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
                <div className="text-xs text-accent-foreground">
                    Entrada: {formatDate(lead.createdAt)}
                </div>
                <div className="mt-1 text-xs">
                    <span className="text-accent-foreground">Resp.: </span>
                    <strong>
                        {lead.assignedTo || "Não atribuído"}
                    </strong>
                </div>
            </CardContent>
        </Card>
    );
}