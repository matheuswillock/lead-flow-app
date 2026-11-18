"use client";

import { useIsReadOnlyAccess } from "@/app/[supabaseId]/components/useIsReadOnlyAccess";

export default function BoardFooter() {
    const isReadOnlyAccess = useIsReadOnlyAccess();

    return (
        <div className="flex items-center justify-end text-xs text-muted-foreground">
            {isReadOnlyAccess
                ? "Use a busca, período e responsável para filtrar."
                : "Dica: arraste os cards entre as colunas. Use a busca, período e responsável para filtrar."}
        </div>
    );
}
