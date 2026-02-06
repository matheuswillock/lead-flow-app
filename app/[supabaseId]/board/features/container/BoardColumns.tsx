import { Badge } from "@/components/ui/badge";
import { div as MotionDiv } from "framer-motion/client";
import { COLUMNS } from "../context/BoardContext";
import useBoardContext from "../context/BoardHook";
import { LeadsLoader } from "./LeadsLoader";
import { LeadsError } from "./LeadsError";
import { LeadCard } from "./LeadCard";
import { Lead } from "../context/BoardTypes";

interface BoardColumnsProps {
    onFinalizeContract: (lead: Lead) => void;
    onScheduleMeeting: (lead: Lead) => void;
    onNoShow: (lead: Lead) => void;
}

export default function BoardColumns({ onFinalizeContract, onScheduleMeeting, onNoShow }: BoardColumnsProps) {
    const { 
        filtered, 
        isLoading,
        errors,
        handleCardMouseDown, 
        handleCardDragStart, 
        handleCardClick, 
        onDrop, 
        onDragOver 
    } = useBoardContext();

    if (isLoading) {
        return (
            <LeadsLoader />
        );
    }

    if (errors.api) {
        return (
            <LeadsError error={errors.api} />
        );
    }

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />

            <div
                className="kanban-scrollbar grid auto-cols-[minmax(18rem,20rem)] grid-flow-col gap-4 overflow-x-auto pb-2 pr-2 flex-1 min-h-0 h-full items-stretch"
            >
                {COLUMNS.map(({ key, title }) => {
                    const items = filtered[key] || [];
                    return (
                        <MotionDiv
                            key={key}
                            className="group col-span-1 flex h-full min-h-0 flex-col rounded-2xl border bg-card p-3 shadow-sm"
                            drag={false}
                            onDrop={(e) => onDrop(e, key)}
                            onDragOver={onDragOver}
                        >
                            {/* Column Header */}
                            <div className="mb-2 flex items-center justify-between bg-primary text-primary-foreground px-2 py-1 rounded-md h-12">
                                <h2 className="text-base font-semibold">{title}</h2>
                                <Badge variant="secondary" className="rounded-full">
                                    {items.length}
                                </Badge>
                            </div>

                            {/* Cards Zone */}
                            <div className="kanban-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pr-3">
                                {items.length === 0 && (
                                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                                        Solte aqui
                                    </div>
                                )}

                                {items.map((lead) => (
                                    <LeadCard
                                        key={lead.id}
                                        lead={lead}
                                        columnKey={key}
                                        handleCardMouseDown={handleCardMouseDown}
                                        handleCardDragStart={handleCardDragStart}
                                        handleCardClick={handleCardClick}
                                        onFinalizeContract={onFinalizeContract}
                                        onScheduleMeeting={onScheduleMeeting}
                                        onNoShow={onNoShow}
                                        attachmentCount={lead.attachmentCount || 0}
                                    />
                                ))}
                            </div>
                        </MotionDiv>
                    );
                })}
            </div>
      </div>
    );
}
