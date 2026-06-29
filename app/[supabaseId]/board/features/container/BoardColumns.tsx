import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { div as MotionDiv } from "framer-motion/client";
import { COLUMNS } from "../context/BoardContext";
import useBoardContext from "../context/BoardHook";
import { LeadsLoader } from "./LeadsLoader";
import { LeadsError } from "./LeadsError";
import { LeadCard } from "./LeadCard";
import { Lead } from "../context/BoardTypes";

const EDGE_AUTOSCROLL_THRESHOLD_PX = 96;
const EDGE_AUTOSCROLL_MAX_SPEED_PX = 24;

interface BoardColumnsProps {
    onFinalizeContract: (lead: Lead) => void;
    onScheduleMeeting: (lead: Lead) => void;
    onNoShow: (lead: Lead) => void;
    onResendScheduleInvite: (lead: Lead) => void;
    onConfirmMeetingPresence: (lead: Lead) => void;
    confirmingPresenceLeadId: string | null;
}

export default function BoardColumns({
    onFinalizeContract,
    onScheduleMeeting,
    onNoShow,
    onResendScheduleInvite,
    onConfirmMeetingPresence,
    confirmingPresenceLeadId,
}: BoardColumnsProps) {
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

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let rafId: number | null = null;
        let speed = 0;

        const step = () => {
            if (speed === 0) {
                rafId = null;
                return;
            }
            container.scrollLeft += speed;
            rafId = requestAnimationFrame(step);
        };

        const ensureLoop = () => {
            if (rafId === null) {
                rafId = requestAnimationFrame(step);
            }
        };

        const stopLoop = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            speed = 0;
        };

        const handleDragOver = (event: DragEvent) => {
            const rect = container.getBoundingClientRect();
            const distanceFromLeft = event.clientX - rect.left;
            const distanceFromRight = rect.right - event.clientX;

            if (distanceFromLeft < EDGE_AUTOSCROLL_THRESHOLD_PX) {
                const ratio = Math.max(0, 1 - distanceFromLeft / EDGE_AUTOSCROLL_THRESHOLD_PX);
                speed = -Math.ceil(ratio * EDGE_AUTOSCROLL_MAX_SPEED_PX);
                ensureLoop();
            } else if (distanceFromRight < EDGE_AUTOSCROLL_THRESHOLD_PX) {
                const ratio = Math.max(0, 1 - distanceFromRight / EDGE_AUTOSCROLL_THRESHOLD_PX);
                speed = Math.ceil(ratio * EDGE_AUTOSCROLL_MAX_SPEED_PX);
                ensureLoop();
            } else {
                stopLoop();
            }
        };

        const handleDragLeave = (event: DragEvent) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (!nextTarget || !container.contains(nextTarget)) {
                stopLoop();
            }
        };

        container.addEventListener("dragover", handleDragOver);
        container.addEventListener("dragleave", handleDragLeave);
        container.addEventListener("drop", stopLoop);
        window.addEventListener("dragend", stopLoop);

        return () => {
            stopLoop();
            container.removeEventListener("dragover", handleDragOver);
            container.removeEventListener("dragleave", handleDragLeave);
            container.removeEventListener("drop", stopLoop);
            window.removeEventListener("dragend", stopLoop);
        };
    }, []);

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
                ref={scrollContainerRef}
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
                                        onResendScheduleInvite={onResendScheduleInvite}
                                        onConfirmMeetingPresence={onConfirmMeetingPresence}
                                        isConfirmingMeetingPresence={confirmingPresenceLeadId === lead.id}
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
