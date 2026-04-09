import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { ArrowRight, LogIn } from "lucide-react";

export function LandingHeader() {
    return (
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-lg" style={{ borderColor: "var(--border)" }}>
            <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold tracking-tight flex-shrink-0">
                    <Image
                        src="/corretor-studio-icon.svg"
                        alt="Corretor Studio"
                        width={32}
                        height={32}
                        className="h-8 w-8"
                        priority
                    />
                    <span className="hidden sm:inline">Corretor Studio</span>
                </Link>

                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                    <Link href="/#features" className="hover:text-foreground transition-colors">
                        Funcionalidades
                    </Link>
                    <Link href="/#email-campaigns" className="hover:text-foreground transition-colors">
                        Campanhas
                    </Link>
                    <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
                        Como funciona
                    </Link>
                    <Link href="/#demo" className="hover:text-foreground transition-colors">
                        Demonstração
                    </Link>
                </nav>

                <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                        asChild
                        variant="ghost"
                        className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-foreground/70 hover:text-foreground"
                    >
                        <Link href="/sign-in">
                            <LogIn className="h-4 w-4" />
                            Entrar
                        </Link>
                    </Button>

                    <Button
                        asChild
                        className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-md"
                        style={{
                            background: "var(--primary)",
                            color: "var(--primary-foreground)",
                            boxShadow: "0 4px 14px -4px color-mix(in oklab, var(--primary) 50%, transparent)",
                        }}
                    >
                        <Link href="/#demo">
                            Começar grátis
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
