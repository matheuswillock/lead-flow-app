-- ─── Fix residual CP850 mojibake in mixed-content rows ─────────────────────
-- The previous migration (20260525150022_fix_cp850_mojibake.sql) used a
-- full-string CP850→UTF-8 reversal. Rows that mix already-clean Portuguese
-- text with mojibake fragments (e.g. a row edited after the initial backup
-- restore) failed UTF-8 validation on the rebuild and were left untouched
-- by the fail-safe path.
--
-- This migration applies targeted substring replacements for the specific
-- mojibake fragments observed in those mixed rows. Each replacement maps
-- a unique mojibake byte sequence to its original character.
-- Idempotent: the WHERE clauses match only rows still containing the
-- exact corrupt fragments.

create or replace function pg_temp.fix_cp850_substrings(input text) returns text as $$
declare
  out_text text := input;
begin
  if input is null then return null; end if;

  -- Smart typography (3-byte UTF-8: E2 80 xx)
  out_text := replace(out_text, 'ÔÇö', '—');   -- em dash      U+2014
  out_text := replace(out_text, 'ÔÇô', '–');   -- en dash      U+2013
  out_text := replace(out_text, 'ÔÇó', '•');   -- bullet       U+2022
  out_text := replace(out_text, 'ÔÇª', '…');   -- ellipsis     U+2026
  out_text := replace(out_text, 'ÔÇ£', '"');   -- ldquo        U+201C
  out_text := replace(out_text, 'ÔÇØ', '"');   -- rdquo        U+201D
  out_text := replace(out_text, 'ÔÇÖ', '''');  -- rsquo        U+2019
  out_text := replace(out_text, 'ÔÇÿ', '''');  -- lsquo        U+2018
  out_text := replace(out_text, 'ÔÇì', E'‍'); -- ZWJ      U+200D

  -- Variation selectors / combining (3-byte: EF B8 8F → ´©Å, EF BB BF → ´╗┐)
  out_text := replace(out_text, '´©Å', E'️');  -- VS-16   U+FE0F
  out_text := replace(out_text, '´╗┐', E'﻿');  -- BOM     U+FEFF

  -- Common emojis observed in the data
  -- ✅ U+2705 → E2 9C 85 → Ô£à
  out_text := replace(out_text, 'Ô£à', '✅');
  -- ❤ U+2764 → E2 9D A4 → ÔØñ
  out_text := replace(out_text, 'ÔØñ', '❤');
  -- ⚧ U+26A7 → E2 9A A7 → ÔÜº
  out_text := replace(out_text, 'ÔÜº', '⚧');
  -- 🏳 U+1F3F3 → F0 9F 8F B3 → ­ƒÅ│
  out_text := replace(out_text, '­ƒÅ│', '🏳');

  return out_text;
end;
$$ language plpgsql immutable;

-- Reuse the same affected-column list as the prior migration.
-- Each UPDATE filters by the presence of any known mojibake fragment to stay idempotent.

-- corretor_studio_leads
update public.corretor_studio_leads set "currentTreatment"  = pg_temp.fix_cp850_substrings("currentTreatment")  where "currentTreatment"  ~ '[├Ô­ƒ´©]' or "currentTreatment"  like '%ÔÇ%';
update public.corretor_studio_leads set "referenceHospital" = pg_temp.fix_cp850_substrings("referenceHospital") where "referenceHospital" ~ '[├Ô­ƒ´©]' or "referenceHospital" like '%ÔÇ%';
update public.corretor_studio_leads set "meetingTitle"      = pg_temp.fix_cp850_substrings("meetingTitle")      where "meetingTitle"      ~ '[├Ô­ƒ´©]' or "meetingTitle"      like '%ÔÇ%';
update public.corretor_studio_leads set "currentHealthPlan" = pg_temp.fix_cp850_substrings("currentHealthPlan") where "currentHealthPlan" ~ '[├Ô­ƒ´©]' or "currentHealthPlan" like '%ÔÇ%';
update public.corretor_studio_leads set "meetingNotes"      = pg_temp.fix_cp850_substrings("meetingNotes")      where "meetingNotes"      ~ '[├Ô­ƒ´©]' or "meetingNotes"      like '%ÔÇ%';
update public.corretor_studio_leads set "lossReasonDetails" = pg_temp.fix_cp850_substrings("lossReasonDetails") where "lossReasonDetails" ~ '[├Ô­ƒ´©]' or "lossReasonDetails" like '%ÔÇ%';
update public.corretor_studio_leads set "lossReason"        = pg_temp.fix_cp850_substrings("lossReason")        where "lossReason"        ~ '[├Ô­ƒ´©]' or "lossReason"        like '%ÔÇ%';
update public.corretor_studio_leads set "soldPlan"          = pg_temp.fix_cp850_substrings("soldPlan")          where "soldPlan"          ~ '[├Ô­ƒ´©]' or "soldPlan"          like '%ÔÇ%';
update public.corretor_studio_leads set "followUpNotes"     = pg_temp.fix_cp850_substrings("followUpNotes")     where "followUpNotes"     ~ '[├Ô­ƒ´©]' or "followUpNotes"     like '%ÔÇ%';
update public.corretor_studio_leads set "notes"             = pg_temp.fix_cp850_substrings("notes")             where "notes"             ~ '[├Ô­ƒ´©]' or "notes"             like '%ÔÇ%';
update public.corretor_studio_leads set "age"               = pg_temp.fix_cp850_substrings("age")               where "age"               ~ '[├Ô­ƒ´©]' or "age"               like '%ÔÇ%';
update public.corretor_studio_leads set "leadCode"          = pg_temp.fix_cp850_substrings("leadCode")          where "leadCode"          ~ '[├Ô­ƒ´©]' or "leadCode"          like '%ÔÇ%';

-- corretor_studio_lead_activities
update public.corretor_studio_lead_activities set "body" = pg_temp.fix_cp850_substrings("body") where "body" ~ '[├Ô­ƒ´©]' or "body" like '%ÔÇ%';

-- corretor_studio_leads_schedule
update public.corretor_studio_leads_schedule set "meetingTitle" = pg_temp.fix_cp850_substrings("meetingTitle") where "meetingTitle" ~ '[├Ô­ƒ´©]' or "meetingTitle" like '%ÔÇ%';
update public.corretor_studio_leads_schedule set "notes"        = pg_temp.fix_cp850_substrings("notes")        where "notes"        ~ '[├Ô­ƒ´©]' or "notes"        like '%ÔÇ%';

-- corretor_studio_lead_attachments
update public.corretor_studio_lead_attachments set "fileName" = pg_temp.fix_cp850_substrings("fileName") where "fileName" ~ '[├Ô­ƒ´©]' or "fileName" like '%ÔÇ%';

-- corretor_studio_notifications
update public.corretor_studio_notifications set "message" = pg_temp.fix_cp850_substrings("message") where "message" ~ '[├Ô­ƒ´©]' or "message" like '%ÔÇ%';

-- backoffice_products
update public.backoffice_products set "name"        = pg_temp.fix_cp850_substrings("name")        where "name"        ~ '[├Ô­ƒ´©]' or "name"        like '%ÔÇ%';
update public.backoffice_products set "description" = pg_temp.fix_cp850_substrings("description") where "description" ~ '[├Ô­ƒ´©]' or "description" like '%ÔÇ%';

-- corretor_studio_lead_activity_reactions
update public.corretor_studio_lead_activity_reactions set "emoji" = pg_temp.fix_cp850_substrings("emoji") where "emoji" ~ '[├Ô­ƒ´©]' or "emoji" like '%ÔÇ%';

-- corretor_studio_profiles
update public.corretor_studio_profiles set "address"    = pg_temp.fix_cp850_substrings("address")    where "address"    ~ '[├Ô­ƒ´©]' or "address"    like '%ÔÇ%';
update public.corretor_studio_profiles set "complement" = pg_temp.fix_cp850_substrings("complement") where "complement" ~ '[├Ô­ƒ´©]' or "complement" like '%ÔÇ%';
update public.corretor_studio_profiles set "city"       = pg_temp.fix_cp850_substrings("city")       where "city"       ~ '[├Ô­ƒ´©]' or "city"       like '%ÔÇ%';

-- backoffice_webhook_events
update public.backoffice_webhook_events set "errorMessage" = pg_temp.fix_cp850_substrings("errorMessage") where "errorMessage" ~ '[├Ô­ƒ´©]' or "errorMessage" like '%ÔÇ%';

-- backoffice_webhook_request_logs
update public.backoffice_webhook_request_logs set "errorMessage" = pg_temp.fix_cp850_substrings("errorMessage") where "errorMessage" ~ '[├Ô­ƒ´©]' or "errorMessage" like '%ÔÇ%';

-- corretor_studio_lead_finalized
update public.corretor_studio_lead_finalized set "notes"       = pg_temp.fix_cp850_substrings("notes")       where "notes"       ~ '[├Ô­ƒ´©]' or "notes"       like '%ÔÇ%';
update public.corretor_studio_lead_finalized set "productName" = pg_temp.fix_cp850_substrings("productName") where "productName" ~ '[├Ô­ƒ´©]' or "productName" like '%ÔÇ%';

-- corretor_studio_pending_operators
update public.corretor_studio_pending_operators set "name" = pg_temp.fix_cp850_substrings("name") where "name" ~ '[├Ô­ƒ´©]' or "name" like '%ÔÇ%';

-- corretor_studio_team_filter_presets
update public.corretor_studio_team_filter_presets set "name" = pg_temp.fix_cp850_substrings("name") where "name" ~ '[├Ô­ƒ´©]' or "name" like '%ÔÇ%';

-- corretor_studio_team_status_rules
update public.corretor_studio_team_status_rules set "confirmationMessage" = pg_temp.fix_cp850_substrings("confirmationMessage") where "confirmationMessage" ~ '[├Ô­ƒ´©]' or "confirmationMessage" like '%ÔÇ%';
