'use client'

import { useEffect, useRef, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import Link from 'next/link'
import { dispatchLandingConsentAnalytics, landingConsentStorageKey } from '@/lib/landing-analytics/client'


export function CookieConsent({ landingPageId = "" }: { landingPageId?: string }) {
  const [visible, setVisible] = useState(false)
  const storageKey = landingConsentStorageKey(landingPageId)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [preferences, setPreferences] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    const openPreferences = () => setPreferencesOpen(true)
    window.addEventListener('open-cookie-preferences', openPreferences)
    const timer = window.setTimeout(() => { if (!saved) setVisible(true) }, 650)
    return () => { window.clearTimeout(timer); window.removeEventListener('open-cookie-preferences', openPreferences) }
  }, [])

  useEffect(() => {
    if (!preferencesOpen) return
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreferencesOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [preferencesOpen])

  const save = (choice: string) => { window.localStorage.setItem(storageKey, choice); dispatchLandingConsentAnalytics(choice === 'necessary' ? 'rejected' : choice === 'all' ? 'accepted' : 'preferences_saved'); setVisible(false); setPreferencesOpen(false) }
  return <>
    {visible && <aside className="cookie-consent" aria-label="Consentimento de cookies"><Cookie size={20} aria-hidden="true" /><p className="eyebrow">Privacidade</p><h2>Nós usamos cookies</h2><p>Utilizamos cookies necessários para o funcionamento da página e, com sua autorização, tecnologias para entender o uso e melhorar sua experiência.</p><Link href={landingPageId ? `/conversao/${landingPageId}/cookies` : "/cookies"} className="cookie-more">Saiba mais sobre cookies</Link><div className="cookie-actions"><button className="cookie-primary" onClick={() => save('all')}>Aceitar todos</button><button className="cookie-secondary" onClick={() => save('necessary')}>Apenas necessários</button><button className="cookie-customize" onClick={() => setPreferencesOpen(true)}>Personalizar</button></div></aside>}
    {preferencesOpen && <div className="cookie-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreferencesOpen(false) }}><div className="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title" tabIndex={-1} ref={dialogRef}><button className="dialog-close" aria-label="Fechar preferências" onClick={() => setPreferencesOpen(false)}><X size={18} /></button><p className="eyebrow">Privacidade</p><h2 id="cookie-dialog-title">Preferências de cookies</h2><p>Escolha quais tipos de cookies você permite.</p><CookieToggle title="Cookies necessários" description="Essenciais para o funcionamento básico da página." checked disabled label="Sempre ativos" /><CookieToggle title="Análise" description="Ajudam a entender como a página é utilizada." checked={analytics} onChange={setAnalytics} /><CookieToggle title="Marketing" description="Podem medir campanhas e personalizar comunicações." checked={marketing} onChange={setMarketing} /><CookieToggle title="Preferências" description="Lembram algumas escolhas feitas durante a navegação." checked={preferences} onChange={setPreferences} /><div className="dialog-actions"><button className="cookie-primary" onClick={() => save(JSON.stringify({ analytics, marketing, preferences }))}>Salvar preferências</button><button className="cookie-secondary" onClick={() => save('all')}>Aceitar todos</button><Link href={landingPageId ? `/conversao/${landingPageId}/cookies` : "/cookies"} className="cookie-more">Política de Cookies</Link></div></div></div>}
  </>
}

function CookieToggle({ title, description, checked, disabled, label, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; label?: string; onChange?: (value: boolean) => void }) {
  return <div className="cookie-toggle-row"><div><h3>{title}</h3><p>{description}</p></div><label className="toggle-label"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} /><span className="toggle" /><span>{label || (checked ? 'Ativo' : 'Inativo')}</span></label></div>
}
