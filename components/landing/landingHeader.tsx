import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { ArrowRight, LogIn } from "lucide-react";
import { MobileNavMenu } from "./MobileNavMenu";

export function LandingHeader() {
    return (
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 h-16 flex items-center">
                <MobileNavMenu />

                <Link href="/" className="flex items-center gap-2 font-bold tracking-tight flex-shrink-0 xl:mr-0 ml-2 xl:ml-0">
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

                <div className="hidden xl:flex flex-1 justify-center px-6">
                    <nav className="flex items-center gap-7 text-sm font-medium text-muted-foreground">
                        <Link href="/#features" className="hover:text-foreground transition-colors">
                            Funcionalidades
                        </Link>
                        <Link href="/#email-campaigns" className="hover:text-foreground transition-colors">
                            Campanhas
                        </Link>
                        <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
                            Como funciona
                        </Link>
                        <Link href="/recursos" className="hover:text-foreground transition-colors">
                            Recursos
                        </Link>
                        <Link href="/#demo" className="hover:text-foreground transition-colors">
                            Demonstração
                        </Link>
                    </nav>
                </div>

                <div className="ml-auto flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
                    <Button
                        asChild
                        variant="ghost"
                        className="inline-flex items-center gap-2 px-2.5 text-sm font-medium text-foreground/70 hover:text-foreground"
                    >
                        <Link href="/sign-in" aria-label="Entrar na conta">
                            <LogIn className="h-4 w-4" />
                            <span>Entrar</span>
                        </Link>
                    </Button>

                    <Button
                        asChild
                        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    >
                        <Link href="/#demo">
                            Agendar demonstração
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
