import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "../context/BoardContext";
import { ColumnKey } from "../context/BoardTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";

interface LeadCardProps {
    lead: LeadResponseDTO;
    columnKey: ColumnKey;
    handleCardMouseDown: () => void;
    handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
    handleCardClick: (lead: LeadResponseDTO) => void;
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
            className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-accent m-0"
        >
            <CardHeader >
                <CardTitle className="text-base font-semibold leading-tight">
                    {lead.name}
                </CardTitle>
                <div className="mt-1 text-xs text-accent-foreground">
                    Entrada: {formatDate(lead.createdAt)}
                </div>
            </CardHeader>
            <CardContent>
                {/* TODO: Avaliar o conteudo para inserir aqui */}
            </CardContent>
            <CardFooter className="w-full flex justify-end">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={lead?.assignee?.avatarUrl || ""} alt={`@${lead?.assignee?.fullName || ""}`} />
                    <AvatarFallback>
                        {lead?.assignee?.fullName
                            ? lead.assignee.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                            : "LF"}
                    </AvatarFallback>
                </Avatar>
            </CardFooter>
        </Card>
    );
}