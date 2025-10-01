import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "../context/BoardContext";
import { ColumnKey } from "../context/BoardTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { CheckCircle } from "lucide-react";

interface LeadCardProps {
    lead: LeadResponseDTO;
    columnKey: ColumnKey;
    handleCardMouseDown: () => void;
    handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
    handleCardClick: (lead: LeadResponseDTO) => void;
    onFinalizeContract?: (lead: LeadResponseDTO) => void;
}

export function LeadCard({
    lead,
    columnKey,
    handleCardMouseDown,
    handleCardDragStart,
    handleCardClick,
    onFinalizeContract,
}: LeadCardProps) {
    // Verifica se o lead está em uma coluna que permite finalizar contrato
    const canFinalizeContract = columnKey === 'invoicePayment' || 
                                columnKey === 'dps_agreement' ||
                                columnKey === 'offerSubmission';

    const handleFinalizeClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Evita que o card seja clicado
        if (onFinalizeContract) {
            onFinalizeContract(lead);
        }
    };

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
                {canFinalizeContract && (
                    <Button
                        size="sm"
                        variant="default"
                        className="w-full cursor-pointer"
                        onClick={handleFinalizeClick}
                    >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Fechar Contrato
                    </Button>
                )}
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