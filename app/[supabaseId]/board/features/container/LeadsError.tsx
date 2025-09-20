interface LeadsErrorProps {
    error: string;
}

export function LeadsError({ error }: LeadsErrorProps) {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
                <p className="text-destructive mb-2">Erro ao carregar leads</p>
                <p className="text-muted-foreground text-sm">{error}</p>
            </div>
        </div>
    );
}