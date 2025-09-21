# Configuração de exemplo para CI/CD

# No GitHub Actions, adicione as seguintes secrets no repositório:
# RESEND_API_KEY=re_xxxxxxxxxx (opcional - se não estiver definida, o sistema funcionará sem emails)
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Exemplo de workflow que agora funciona:

name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest
    
    - name: Install dependencies
      run: bun install --frozen-lockfile
    
    - name: Generate Prisma Client
      run: bun run prisma:generate
    
    - name: Type Check
      run: bun run typecheck
    
    - name: Build
      run: bun run build
      env:
        CI: true
        NEXT_TELEMETRY_DISABLED: 1
        # RESEND_API_KEY é opcional - se não estiver definida, emails serão desabilitados
        RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

# ✅ AGORA O BUILD FUNCIONARÁ MESMO SEM A RESEND_API_KEY
# ✅ O sistema funciona normalmente, apenas os emails serão desabilitados