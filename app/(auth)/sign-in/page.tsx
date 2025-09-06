"use client"
import { useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"


export default function SignInPage() {
  const supabase = createSupabaseBrowser()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else window.location.href = "/dashboard"
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/dashboard` } })
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">Entrar</Button>
        <Button type="button" variant="secondary" className="w-full" onClick={signInWithGoogle}>
          Entrar com Google
        </Button>
      </form>
    </main>
  )
}
