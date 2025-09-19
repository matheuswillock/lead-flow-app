import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { div as MotionDiv } from "framer-motion/client";
import { useBoardContext, COLUMNS, formatDate } from "../BoardContext";

export default function BoardColumns() {
    const { 
        filtered, 
        handleCardMouseDown, 
        handleCardDragStart, 
        handleCardClick, 
        onDrop, 
        onDragOver 
    } = useBoardContext();

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />

            <div
            className="grid auto-cols-[minmax(18rem,20rem)] grid-flow-col gap-4 overflow-x-auto pb-2 pr-2"
            style={{ scrollSnapType: "x proximity" }}
            >
            {COLUMNS.map(({ key, title }) => {
                const items = filtered[key] || []; // Fallback para array vazio
                return (
                <MotionDiv
                    key={key}
                    className="col-span-1 flex min-h-[70vh] flex-col rounded-2xl border bg-card p-3 shadow-sm"
                    drag={false}
                    style={{ scrollSnapAlign: "start" }}
                    onDrop={(e) => onDrop(e, key)}
                    onDragOver={onDragOver}
                >
                    {/* Cabeçalho da coluna */}
                    <div className="mb-2 flex items-center justify-between bg-primary text-primary-foreground px-2 py-1 rounded-md h-12">
                    <h2 className="text-base font-semibold">{title}</h2>
                    <Badge variant="secondary" className="rounded-full">
                        {items.length}
                    </Badge>
                    </div>

                    {/* Zona de cards */}
                    <div className="flex flex-1 flex-col gap-2">
                        {items.length === 0 && (
                            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                            Solte aqui
                            </div>
                        )}

                        {items.map((lead) => (
                            <Card
                                key={lead.id}
                                draggable
                                onMouseDown={handleCardMouseDown}
                                onDragStart={(e) => handleCardDragStart(e, lead.id, key)}
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
                                    Entrada: {formatDate(lead.enteredAt)}
                                    </div>
                                    <div className="mt-1 text-xs">
                                    <span className="text-accent-foreground">Resp.: </span>
                                    <strong>
                                        {lead.responsible}
                                    </strong>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </MotionDiv>
                );
            })}
            </div>
      </div>
    );
}