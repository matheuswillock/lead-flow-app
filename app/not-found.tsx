import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">404 - Página não encontrada</h2>
        <p className="text-muted-foreground mb-4">
          A página que você está procurando não existe.
        </p>
        <Link href="/" className="text-primary hover:underline">
          Voltar para a página inicial
        </Link>
      </div>
    </div>
  )
}
