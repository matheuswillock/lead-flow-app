interface LeadsErrorProps {
    error: string;
}

export function LeadsError({ error }: LeadsErrorProps) {
    return (
        <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="text-center">
                <p className="text-destructive mb-2">Erro ao carregar leads</p>
                <p className="text-muted-foreground text-sm">{error}</p>
            </div>
        </div>
    );
}
