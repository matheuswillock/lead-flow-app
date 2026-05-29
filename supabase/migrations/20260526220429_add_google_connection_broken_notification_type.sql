do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'notification_type'
      and e.enumlabel = 'GOOGLE_CONNECTION_BROKEN'
  ) then
    alter type public.notification_type add value 'GOOGLE_CONNECTION_BROKEN';
  end if;
end$$;
