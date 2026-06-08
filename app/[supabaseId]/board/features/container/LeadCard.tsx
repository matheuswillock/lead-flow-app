"use client";

import { memo } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "../context/BoardContext";
import { ColumnKey } from "../context/BoardTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { CheckCircle, Calendar, Video } from "lucide-react";
import { Paperclip } from "@/components/ui/paperclip";
import { Badge } from "@/components/ui/badge";
import { CopyIcon } from "@/components/ui/copy";
import { toast } from "sonner";
import useBoardContext from "../context/BoardHook";
import { cn } from "@/lib/utils";
import { isMeetingOverdue } from "@/lib/lead-meeting";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates"

interface LeadCardProps {
    lead: LeadResponseDTO;
    columnKey: ColumnKey;
    handleCardMouseDown: () => void;
    handleCardDragStart: (e: React.DragEvent, leadId: string, from: ColumnKey) => void;
    handleCardClick: (lead: LeadResponseDTO) => void;
    onFinalizeContract?: (lead: LeadResponseDTO) => void;
    onScheduleMeeting?: (lead: LeadResponseDTO) => void;
    onNoShow?: (lead: LeadResponseDTO) => void;
    attachmentCount?: number;
}

function LeadCardComponent({
    lead,
    columnKey,
    handleCardMouseDown,
    handleCardDragStart,
    handleCardClick,
    onFinalizeContract,
    onScheduleMeeting,
    onNoShow,
    attachmentCount = 0,
}: LeadCardProps) {
    const { leadCardDisplay } = useBoardContext();
    const { tz } = useTimezone();
    const showName = leadCardDisplay.name;
    const showId = leadCardDisplay.id;
    const showEntryDate = leadCardDisplay.entryDate;
    const showMeetingInfo = leadCardDisplay.meetingInfo;
    const showNotes = leadCardDisplay.notes;
    const notesValue = lead.notes?.trim() || "";
    const showNotesSection = showNotes && notesValue.length > 0;
    const hasHeaderInfo = showName || showId || showEntryDate;

    // Verifica se o lead está em uma coluna que permite finalizar contrato
    const canFinalizeContract = columnKey === 'invoicePayment' || 
                                columnKey === 'dps_agreement' ||
                                columnKey === 'offerSubmission';

    // Verifica se o lead está na coluna de nova oportunidade (pode agendar)
    const canScheduleMeeting = columnKey === 'new_opportunity';
    const isScheduled = columnKey === 'scheduled';
    const isNoShow = columnKey === 'no_show';
    const canMarkNoShow =
        isScheduled && isMeetingOverdue(lead.meetingDate) && lead.meetingHeald !== "yes";

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

    const handleNoShowClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onNoShow) {
            onNoShow(lead);
        }
    };

    const handleJoinMeeting = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lead.meetingLink) return;
        window.open(lead.meetingLink, "_blank", "noopener,noreferrer");
    };

    const handleAttachmentClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Evita que o card seja clicado
        handleCardClick(lead); // Abre o dialog para ver/adicionar anexos
    };

    const formatMeetingDateTime = (value: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return formatIntimezone(date, "dd/MM/yyyy HH:mm", tz);
    };

    const closerName = lead.closer?.fullName || lead.closer?.email;
    const hasMeetingInfo = Boolean(lead.meetingDate || lead.meetingNotes || closerName);

    const handleCopyLeadCode = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(lead.leadCode);
            toast.success("ID copiado");
        } catch (error) {
            console.error("Erro ao copiar ID do lead:", error);
            toast.error("Não foi possível copiar o ID");
        }
    };


    return (
        <Card
            key={lead.id}
            draggable
            onMouseDown={handleCardMouseDown}
            onDragStart={(e) => handleCardDragStart(e, lead.id, columnKey)}
            onClick={() => handleCardClick(lead)}
            className={cn(
                "cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-accent m-0",
                lead.isLeadTimeBreached && "border-destructive/70 ring-1 ring-destructive/40 animate-pulse"
            )}
        >
            {hasHeaderInfo && (
                <CardHeader>
                    {showName && (
                        <CardTitle className="text-base font-semibold leading-tight">
                            {lead.name}
                        </CardTitle>
                    )}
                    {showId && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-accent-foreground">
                            <span>ID: {lead.leadCode}</span>
                            <button
                                type="button"
                                onClick={handleCopyLeadCode}
                                className="rounded-md p-1 transition-colors hover:bg-accent/60"
                                aria-label="Copiar ID do lead"
                            >
                                <CopyIcon size={16} />
                            </button>
                        </div>
                    )}
                    {showEntryDate && (
                        <div className="mt-1 text-xs text-accent-foreground">
                            Entrada: {formatDate(lead.createdAt, tz)}
                        </div>
                    )}
                </CardHeader>
            )}
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
                {isNoShow && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full cursor-pointer"
                        onClick={handleScheduleClick}
                    >
                        <Calendar className="mr-2 h-4 w-4" />
                        Reagendar Reunião
                    </Button>
                )}
                {canMarkNoShow && (
                    <div className="flex flex-col gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full cursor-pointer"
                            onClick={handleNoShowClick}
                        >
                            Marcar No-show
                        </Button>
                        {lead.meetingLink && (
                            <Button
                                size="sm"
                                variant="default"
                                className="w-full cursor-pointer"
                                onClick={handleJoinMeeting}
                            >
                                <Video className="mr-2 h-4 w-4" />
                                Ir para Reunião
                            </Button>
                        )}
                    </div>
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
                {showMeetingInfo && hasMeetingInfo && (
                    <div className="mt-3 pt-3 border-t border-border/60 text-xs text-accent-foreground space-y-3">
                        <div className="text-sm font-semibold text-foreground">Informações de agendamento</div>
                        {lead.meetingDate && (
                            <div>Data e horário: {formatMeetingDateTime(lead.meetingDate)}</div>
                        )}
                        {lead.meetingNotes && (
                            <div>Observações: {lead.meetingNotes}</div>
                        )}
                        {closerName && (
                            <div>Closer: {closerName}</div>
                        )}
                    </div>
                )}
                {lead.isLeadTimeBreached && (
                    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                        Lead a vencer: tempo máximo neste status ultrapassado.
                    </div>
                )}
                {showNotesSection && (
                    <div className="mt-3 pt-3 border-t border-border/60 text-xs text-accent-foreground space-y-2">
                        <div className="text-sm font-semibold text-foreground">Observações</div>
                        <div className="whitespace-pre-line break-words">{notesValue}</div>
                    </div>
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

export const LeadCard = memo(LeadCardComponent);
