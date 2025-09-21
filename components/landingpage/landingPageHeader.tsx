import Link from "next/link";
import { Button } from "../ui/button";
import { LogIn } from "lucide-react";

export function LandingPageHeader() {
    return (
        <header className="sticky top-0 z-20 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
                    <span
                        className="inline-block h-6 w-6 rounded-md"
                        style={{ background: "var(--primary)" }}
                        aria-hidden
                    />
                    <span>Lead Flow</span>
                </Link>

                <Button
                    className="cursor-pointer inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-lg font-semibold text-foreground/80 hover:text-foreground "
                    variant="link"
                >
                    <Link href="/sign-in" className="inline-flex items-center gap-2">
                        <LogIn className="h-8 w-8" /> Entrar
                    </Link>
                </Button>
            </div>
        </header>
    );
}