-- ─── Manual fix: U+FFFD replacement-char inside leads.notes ────────────────
-- Three rows in corretor_studio_leads.notes contained the sequence "´┐¢"
-- (UTF-8 replacement char U+FFFD re-encoded via CP850) in place of accented
-- vowels in Brazilian municipality names. The original byte was already
-- lost — these substitutions were chosen by context.
--
-- The same UPDATE statements were already executed on the remote via
-- ad-hoc SQL during the mojibake cleanup task. Re-applying here keeps the
-- migration history in sync with the actual remote state. The replace()
-- calls are idempotent — once the source substring is gone, they are no-ops.

update public.corretor_studio_leads
   set "notes" = replace("notes", 'Macei´┐¢', 'Maceió')
 where id = '51099259-a64c-4252-a18a-6d1797e3aa9a'
   and "notes" like '%Macei´┐¢%';

update public.corretor_studio_leads
   set "notes" = replace(replace("notes", 'V´┐¢rzea', 'Várzea'), 'Po´┐¢o', 'Poço')
 where id = '81242678-101d-4670-b069-fbd66ebc10cc'
   and "notes" like '%´┐¢%';

update public.corretor_studio_leads
   set "notes" = replace(replace("notes", 'Riach´┐¢o', 'Riachão'), 'Jacu´┐¢pe', 'Jacuípe')
 where id = '940db2f4-e819-4b14-83d9-d052ae67c10d'
   and "notes" like '%´┐¢%';
