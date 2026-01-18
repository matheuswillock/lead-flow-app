import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "../context/BoardContext";
import { ColumnKey } from "../context/BoardTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { CheckCircle, Calendar } from "lucide-react";
import { Paperclip } from "@/components/ui/paperclip";
import { Badge } from "@/components/ui/badge";

interface LeadCardProps {
    lead: LeadResponseDTO;
    columnKey: ColumnKey;
    handleCardMouseDown: () => void;
    handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
    handleCardClick: (lead: LeadResponseDTO) => void;
    onFinalizeContract?: (lead: LeadResponseDTO) => void;
    onScheduleMeeting?: (lead: LeadResponseDTO) => void;
    attachmentCount?: number;
}

export function LeadCard({
    lead,
    columnKey,
    handleCardMouseDown,
    handleCardDragStart,
    handleCardClick,
    onFinalizeContract,
    onScheduleMeeting,
    attachmentCount = 0,
}: LeadCardProps) {
    // Verifica se o lead está em uma coluna que permite finalizar contrato
    const canFinalizeContract = columnKey === 'invoicePayment' || 
                                columnKey === 'dps_agreement' ||
                                columnKey === 'offerSubmission';

    // Verifica se o lead está na coluna de nova oportunidade (pode agendar)
    const canScheduleMeeting = columnKey === 'new_opportunity';

    const handleFinalizeClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Evita que o card seja clicado
        if (onFinalizeContract) {
            onFinalizeContract(lead);
        }
    };

    const handleScheduleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Evita que o card seja clicado
        if (onScheduleMeeting) {
            onScheduleMeeting(lead);
        }
    };

    const handleAttachmentClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Evita que o card seja clicado
        handleCardClick(lead); // Abre o dialog para ver/adicionar anexos
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
                {canScheduleMeeting && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full cursor-pointer"
                        onClick={handleScheduleClick}
                    >
                        <Calendar className="mr-2 h-4 w-4" />
                        Agendar Reunião
                    </Button>
                )}
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
            <CardFooter className="w-full flex justify-between items-center">
                {attachmentCount > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 relative cursor-pointer hover:bg-accent/50"
                        onClick={handleAttachmentClick}
                        title={`${attachmentCount} anexo${attachmentCount > 1 ? 's' : ''}`}
                    >
                        <Paperclip animateOnHover className="h-4 w-4" />
                        <Badge 
                            variant="secondary" 
                            className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                        >
                            {attachmentCount}
                        </Badge>
                    </Button>
                )}
                {attachmentCount === 0 && (
                    <div className="h-8 w-8" />
                )}
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