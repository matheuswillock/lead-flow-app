"use client"

import Link from "next/link"

export default function SignUpPage() {
	return (
		<main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
			<div className="w-full max-w-sm text-center space-y-4">
				<h1 className="text-2xl font-bold">Criar conta</h1>
				<p className="text-sm text-muted-foreground">Página de cadastro em construção.</p>
				<Link href="/sign-in" className="underline underline-offset-4 text-sm">Voltar para login</Link>
			</div>
		</main>
	)
}

// TODO: Implementar formulário de cadastro real
