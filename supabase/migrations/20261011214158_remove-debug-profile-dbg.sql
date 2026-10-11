-- Remove somente o profile de debug sem dados de produto, cobrança ou Auth.
-- Pré-condições verificadas em 2026-10-11: sem subscription, ledger, cartão,
-- change order, patrocínio, backoffice ou supabase_id.
DELETE FROM public.corretor_studio_profiles
WHERE id = '5e06896c-48a3-4561-874c-e921e3003d1f'::uuid
  AND email = '/tmp/dbg.ts'
  AND "fullName" = 'DBG';

