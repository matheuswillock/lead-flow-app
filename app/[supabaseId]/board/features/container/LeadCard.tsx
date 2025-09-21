import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "../context/BoardContext";
import { Lead, ColumnKey } from "../context/BoardTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
                    <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                    <AvatarFallback>CN</AvatarFallback>
                </Avatar>
            </CardFooter>
        </Card>
    );
}