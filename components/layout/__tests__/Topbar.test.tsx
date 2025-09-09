import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Topbar } from '../Topbar'
import React from 'react'

// Minimal AuthContext mock
import * as AuthModule from '@/app/context/AuthContext'
import { ThemeProvider } from '@/components/theme-provider'

describe('Topbar', () => {
  it('matches snapshot (no user)', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({ user: null, loading: false, signOut: vi.fn() } as any)

    const { container } = render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Topbar open={false} onToggle={() => {}} />
      </ThemeProvider>
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
