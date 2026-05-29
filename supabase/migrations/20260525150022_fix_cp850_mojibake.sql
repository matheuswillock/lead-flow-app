-- ─── Fix CP850 mojibake in user-typed text ─────────────────────────────────
-- After a backup/restore performed on a Windows host with CP850 console codepage,
-- UTF-8 text fields were re-decoded as CP850 and re-encoded as UTF-8, producing
-- mojibake like "Vital├¡cio" instead of "Vitalício".
--
-- Reversal: each visible mojibake character maps to a single CP850 byte (0x00–0xFF).
-- Rebuild the byte stream and decode as UTF-8 to recover the original text.
-- Postgres does not ship a CP850 conversion, so the mapping is inlined below.
--
-- The fix function is:
--   * idempotent: rows without mojibake markers are skipped via WHERE clause
--   * fail-safe : returns the input unchanged if any char is outside CP850
--                 or the rebuilt byte sequence is not valid UTF-8
--
-- All 30 columns identified by the production scan are updated.

create or replace function pg_temp.fix_cp850_mojibake(input text) returns text as $$
declare
  buf      bytea := '\x'::bytea;
  ch       text;
  cp       int;
  b        int;
  i        int;
  n        int;
begin
  if input is null then
    return null;
  end if;

  -- Fast path: skip rows with no mojibake markers
  if input !~ '[├Ô­ƒ´©]' and position('ÔÇ' in input) = 0 then
    return input;
  end if;

  n := length(input);
  for i in 1..n loop
    ch := substr(input, i, 1);
    cp := ascii(ch);
    b := case cp
      -- CP850 0x80..0xFF mapping (codepoint -> byte)
      when 199  then 128  -- Ç
      when 252  then 129  -- ü
      when 233  then 130  -- é
      when 226  then 131  -- â
      when 228  then 132  -- ä
      when 224  then 133  -- à
      when 229  then 134  -- å
      when 231  then 135  -- ç
      when 234  then 136  -- ê
      when 235  then 137  -- ë
      when 232  then 138  -- è
      when 239  then 139  -- ï
      when 238  then 140  -- î
      when 236  then 141  -- ì
      when 196  then 142  -- Ä
      when 197  then 143  -- Å
      when 201  then 144  -- É
      when 230  then 145  -- æ
      when 198  then 146  -- Æ
      when 244  then 147  -- ô
      when 246  then 148  -- ö
      when 242  then 149  -- ò
      when 251  then 150  -- û
      when 249  then 151  -- ù
      when 255  then 152  -- ÿ
      when 214  then 153  -- Ö
      when 220  then 154  -- Ü
      when 248  then 155  -- ø
      when 163  then 156  -- £
      when 216  then 157  -- Ø
      when 215  then 158  -- ×
      when 402  then 159  -- ƒ
      when 225  then 160  -- á
      when 237  then 161  -- í
      when 243  then 162  -- ó
      when 250  then 163  -- ú
      when 241  then 164  -- ñ
      when 209  then 165  -- Ñ
      when 170  then 166  -- ª
      when 186  then 167  -- º
      when 191  then 168  -- ¿
      when 174  then 169  -- ®
      when 172  then 170  -- ¬
      when 189  then 171  -- ½
      when 188  then 172  -- ¼
      when 161  then 173  -- ¡
      when 171  then 174  -- «
      when 187  then 175  -- »
      when 9617 then 176  -- ░
      when 9618 then 177  -- ▒
      when 9619 then 178  -- ▓
      when 9474 then 179  -- │
      when 9508 then 180  -- ┤
      when 193  then 181  -- Á
      when 194  then 182  -- Â
      when 192  then 183  -- À
      when 169  then 184  -- ©
      when 9571 then 185  -- ╣
      when 9553 then 186  -- ║
      when 9559 then 187  -- ╗
      when 9565 then 188  -- ╝
      when 162  then 189  -- ¢
      when 165  then 190  -- ¥
      when 9488 then 191  -- ┐
      when 9492 then 192  -- └
      when 9524 then 193  -- ┴
      when 9516 then 194  -- ┬
      when 9500 then 195  -- ├
      when 9472 then 196  -- ─
      when 9532 then 197  -- ┼
      when 227  then 198  -- ã
      when 195  then 199  -- Ã
      when 9562 then 200  -- ╚
      when 9556 then 201  -- ╔
      when 9577 then 202  -- ╩
      when 9574 then 203  -- ╦
      when 9568 then 204  -- ╠
      when 9552 then 205  -- ═
      when 9580 then 206  -- ╬
      when 164  then 207  -- ¤
      when 240  then 208  -- ð
      when 208  then 209  -- Ð
      when 202  then 210  -- Ê
      when 203  then 211  -- Ë
      when 200  then 212  -- È
      when 305  then 213  -- ı
      when 205  then 214  -- Í
      when 206  then 215  -- Î
      when 207  then 216  -- Ï
      when 9496 then 217  -- ┘
      when 9484 then 218  -- ┌
      when 9608 then 219  -- █
      when 9604 then 220  -- ▄
      when 166  then 221  -- ¦
      when 204  then 222  -- Ì
      when 9600 then 223  -- ▀
      when 211  then 224  -- Ó
      when 223  then 225  -- ß
      when 212  then 226  -- Ô
      when 210  then 227  -- Ò
      when 245  then 228  -- õ
      when 213  then 229  -- Õ
      when 181  then 230  -- µ
      when 254  then 231  -- þ
      when 222  then 232  -- Þ
      when 218  then 233  -- Ú
      when 219  then 234  -- Û
      when 217  then 235  -- Ù
      when 253  then 236  -- ý
      when 221  then 237  -- Ý
      when 175  then 238  -- ¯
      when 180  then 239  -- ´
      when 173  then 240  -- ­ (soft hyphen)
      when 177  then 241  -- ±
      when 8215 then 242  -- ‗
      when 190  then 243  -- ¾
      when 182  then 244  -- ¶
      when 167  then 245  -- §
      when 247  then 246  -- ÷
      when 184  then 247  -- ¸
      when 176  then 248  -- °
      when 168  then 249  -- ¨
      when 183  then 250  -- ·
      when 185  then 251  -- ¹
      when 179  then 252  -- ³
      when 178  then 253  -- ²
      when 9632 then 254  -- ■
      when 160  then 255  -- nbsp
      else cp -- ASCII (0..127) and any unmapped codepoint keep their value
    end;

    if b is null or b < 0 or b > 255 then
      return input;
    end if;

    buf := buf || set_byte('\x00'::bytea, 0, b);
  end loop;

  begin
    return convert_from(buf, 'UTF8');
  exception when others then
    return input;
  end;
end;
$$ language plpgsql immutable;

-- ─── Apply fix to all affected columns ─────────────────────────────────────
-- WHERE filters keep this idempotent: rows already clean are not touched.

-- corretor_studio_leads
update public.corretor_studio_leads set "currentTreatment"  = pg_temp.fix_cp850_mojibake("currentTreatment")  where "currentTreatment"  ~ '[├Ô­ƒ´©]' or "currentTreatment"  like '%ÔÇ%';
update public.corretor_studio_leads set "referenceHospital" = pg_temp.fix_cp850_mojibake("referenceHospital") where "referenceHospital" ~ '[├Ô­ƒ´©]' or "referenceHospital" like '%ÔÇ%';
update public.corretor_studio_leads set "meetingTitle"      = pg_temp.fix_cp850_mojibake("meetingTitle")      where "meetingTitle"      ~ '[├Ô­ƒ´©]' or "meetingTitle"      like '%ÔÇ%';
update public.corretor_studio_leads set "currentHealthPlan" = pg_temp.fix_cp850_mojibake("currentHealthPlan") where "currentHealthPlan" ~ '[├Ô­ƒ´©]' or "currentHealthPlan" like '%ÔÇ%';
update public.corretor_studio_leads set "meetingNotes"      = pg_temp.fix_cp850_mojibake("meetingNotes")      where "meetingNotes"      ~ '[├Ô­ƒ´©]' or "meetingNotes"      like '%ÔÇ%';
update public.corretor_studio_leads set "lossReasonDetails" = pg_temp.fix_cp850_mojibake("lossReasonDetails") where "lossReasonDetails" ~ '[├Ô­ƒ´©]' or "lossReasonDetails" like '%ÔÇ%';
update public.corretor_studio_leads set "lossReason"        = pg_temp.fix_cp850_mojibake("lossReason")        where "lossReason"        ~ '[├Ô­ƒ´©]' or "lossReason"        like '%ÔÇ%';
update public.corretor_studio_leads set "soldPlan"          = pg_temp.fix_cp850_mojibake("soldPlan")          where "soldPlan"          ~ '[├Ô­ƒ´©]' or "soldPlan"          like '%ÔÇ%';
update public.corretor_studio_leads set "followUpNotes"     = pg_temp.fix_cp850_mojibake("followUpNotes")     where "followUpNotes"     ~ '[├Ô­ƒ´©]' or "followUpNotes"     like '%ÔÇ%';
update public.corretor_studio_leads set "notes"             = pg_temp.fix_cp850_mojibake("notes")             where "notes"             ~ '[├Ô­ƒ´©]' or "notes"             like '%ÔÇ%';
update public.corretor_studio_leads set "age"               = pg_temp.fix_cp850_mojibake("age")               where "age"               ~ '[├Ô­ƒ´©]' or "age"               like '%ÔÇ%';
update public.corretor_studio_leads set "leadCode"          = pg_temp.fix_cp850_mojibake("leadCode")          where "leadCode"          ~ '[├Ô­ƒ´©]' or "leadCode"          like '%ÔÇ%';

-- corretor_studio_lead_activities
update public.corretor_studio_lead_activities set "body" = pg_temp.fix_cp850_mojibake("body") where "body" ~ '[├Ô­ƒ´©]' or "body" like '%ÔÇ%';

-- corretor_studio_leads_schedule
update public.corretor_studio_leads_schedule set "meetingTitle" = pg_temp.fix_cp850_mojibake("meetingTitle") where "meetingTitle" ~ '[├Ô­ƒ´©]' or "meetingTitle" like '%ÔÇ%';
update public.corretor_studio_leads_schedule set "notes"        = pg_temp.fix_cp850_mojibake("notes")        where "notes"        ~ '[├Ô­ƒ´©]' or "notes"        like '%ÔÇ%';

-- corretor_studio_lead_attachments
update public.corretor_studio_lead_attachments set "fileName" = pg_temp.fix_cp850_mojibake("fileName") where "fileName" ~ '[├Ô­ƒ´©]' or "fileName" like '%ÔÇ%';

-- corretor_studio_notifications
update public.corretor_studio_notifications set "message" = pg_temp.fix_cp850_mojibake("message") where "message" ~ '[├Ô­ƒ´©]' or "message" like '%ÔÇ%';

-- backoffice_products
update public.backoffice_products set "name"        = pg_temp.fix_cp850_mojibake("name")        where "name"        ~ '[├Ô­ƒ´©]' or "name"        like '%ÔÇ%';
update public.backoffice_products set "description" = pg_temp.fix_cp850_mojibake("description") where "description" ~ '[├Ô­ƒ´©]' or "description" like '%ÔÇ%';

-- corretor_studio_lead_activity_reactions
update public.corretor_studio_lead_activity_reactions set "emoji" = pg_temp.fix_cp850_mojibake("emoji") where "emoji" ~ '[├Ô­ƒ´©]' or "emoji" like '%ÔÇ%';

-- corretor_studio_profiles
update public.corretor_studio_profiles set "address"    = pg_temp.fix_cp850_mojibake("address")    where "address"    ~ '[├Ô­ƒ´©]' or "address"    like '%ÔÇ%';
update public.corretor_studio_profiles set "complement" = pg_temp.fix_cp850_mojibake("complement") where "complement" ~ '[├Ô­ƒ´©]' or "complement" like '%ÔÇ%';
update public.corretor_studio_profiles set "city"       = pg_temp.fix_cp850_mojibake("city")       where "city"       ~ '[├Ô­ƒ´©]' or "city"       like '%ÔÇ%';

-- backoffice_webhook_events
update public.backoffice_webhook_events set "errorMessage" = pg_temp.fix_cp850_mojibake("errorMessage") where "errorMessage" ~ '[├Ô­ƒ´©]' or "errorMessage" like '%ÔÇ%';

-- backoffice_webhook_request_logs
update public.backoffice_webhook_request_logs set "errorMessage" = pg_temp.fix_cp850_mojibake("errorMessage") where "errorMessage" ~ '[├Ô­ƒ´©]' or "errorMessage" like '%ÔÇ%';

-- corretor_studio_lead_finalized
update public.corretor_studio_lead_finalized set "notes"       = pg_temp.fix_cp850_mojibake("notes")       where "notes"       ~ '[├Ô­ƒ´©]' or "notes"       like '%ÔÇ%';
update public.corretor_studio_lead_finalized set "productName" = pg_temp.fix_cp850_mojibake("productName") where "productName" ~ '[├Ô­ƒ´©]' or "productName" like '%ÔÇ%';

-- corretor_studio_pending_operators
update public.corretor_studio_pending_operators set "name" = pg_temp.fix_cp850_mojibake("name") where "name" ~ '[├Ô­ƒ´©]' or "name" like '%ÔÇ%';

-- corretor_studio_team_filter_presets
update public.corretor_studio_team_filter_presets set "name" = pg_temp.fix_cp850_mojibake("name") where "name" ~ '[├Ô­ƒ´©]' or "name" like '%ÔÇ%';

-- corretor_studio_team_status_rules
update public.corretor_studio_team_status_rules set "confirmationMessage" = pg_temp.fix_cp850_mojibake("confirmationMessage") where "confirmationMessage" ~ '[├Ô­ƒ´©]' or "confirmationMessage" like '%ÔÇ%';
