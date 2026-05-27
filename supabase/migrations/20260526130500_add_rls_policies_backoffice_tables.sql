-- SECURITY DEFINER function to check if the authenticated user is an active backoffice user
create or replace function public.is_active_backoffice_user()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.backoffice_users bu
    join public.corretor_studio_profiles p on p.id = bu."profileId"
    where (p."supabaseId" = auth.uid() or p.id = auth.uid())
      and bu."isActive" = true
  );
$$;

-- backoffice_users
create policy "backoffice_users_select" on public.backoffice_users for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_users_insert" on public.backoffice_users for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_users_update" on public.backoffice_users for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_users_delete" on public.backoffice_users for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_leads
create policy "backoffice_leads_select" on public.backoffice_leads for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_leads_insert" on public.backoffice_leads for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_leads_update" on public.backoffice_leads for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_leads_delete" on public.backoffice_leads for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_adhesions
create policy "backoffice_adhesions_select" on public.backoffice_adhesions for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_adhesions_insert" on public.backoffice_adhesions for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_adhesions_update" on public.backoffice_adhesions for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_adhesions_delete" on public.backoffice_adhesions for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_clients
create policy "backoffice_clients_select" on public.backoffice_clients for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_clients_insert" on public.backoffice_clients for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_clients_update" on public.backoffice_clients for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_clients_delete" on public.backoffice_clients for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_feature_access_rules
create policy "backoffice_feature_access_rules_select" on public.backoffice_feature_access_rules for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_feature_access_rules_insert" on public.backoffice_feature_access_rules for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_feature_access_rules_update" on public.backoffice_feature_access_rules for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_feature_access_rules_delete" on public.backoffice_feature_access_rules for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_feature_grants
create policy "backoffice_feature_grants_select" on public.backoffice_feature_grants for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_feature_grants_insert" on public.backoffice_feature_grants for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_feature_grants_update" on public.backoffice_feature_grants for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_feature_grants_delete" on public.backoffice_feature_grants for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_features
create policy "backoffice_features_select" on public.backoffice_features for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_features_insert" on public.backoffice_features for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_features_update" on public.backoffice_features for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_features_delete" on public.backoffice_features for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_leads_schedule
create policy "backoffice_leads_schedule_select" on public.backoffice_leads_schedule for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_leads_schedule_insert" on public.backoffice_leads_schedule for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_leads_schedule_update" on public.backoffice_leads_schedule for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_leads_schedule_delete" on public.backoffice_leads_schedule for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_payments
create policy "backoffice_payments_select" on public.backoffice_payments for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_payments_insert" on public.backoffice_payments for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_payments_update" on public.backoffice_payments for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_payments_delete" on public.backoffice_payments for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_product_payment_rules
create policy "backoffice_product_payment_rules_select" on public.backoffice_product_payment_rules for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_product_payment_rules_insert" on public.backoffice_product_payment_rules for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_product_payment_rules_update" on public.backoffice_product_payment_rules for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_product_payment_rules_delete" on public.backoffice_product_payment_rules for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_products
create policy "backoffice_products_select" on public.backoffice_products for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_products_insert" on public.backoffice_products for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_products_update" on public.backoffice_products for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_products_delete" on public.backoffice_products for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_user_subscriptions
create policy "backoffice_user_subscriptions_select" on public.backoffice_user_subscriptions for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_user_subscriptions_insert" on public.backoffice_user_subscriptions for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_user_subscriptions_update" on public.backoffice_user_subscriptions for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_user_subscriptions_delete" on public.backoffice_user_subscriptions for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_webhook_events
create policy "backoffice_webhook_events_select" on public.backoffice_webhook_events for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_webhook_events_insert" on public.backoffice_webhook_events for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_webhook_events_update" on public.backoffice_webhook_events for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_webhook_events_delete" on public.backoffice_webhook_events for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_webhook_request_logs
create policy "backoffice_webhook_request_logs_select" on public.backoffice_webhook_request_logs for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_webhook_request_logs_insert" on public.backoffice_webhook_request_logs for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_webhook_request_logs_update" on public.backoffice_webhook_request_logs for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_webhook_request_logs_delete" on public.backoffice_webhook_request_logs for delete to authenticated
  using (public.is_active_backoffice_user());

-- backoffice_webhook_tokens
create policy "backoffice_webhook_tokens_select" on public.backoffice_webhook_tokens for select to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_webhook_tokens_insert" on public.backoffice_webhook_tokens for insert to authenticated
  with check (public.is_active_backoffice_user());
create policy "backoffice_webhook_tokens_update" on public.backoffice_webhook_tokens for update to authenticated
  using (public.is_active_backoffice_user());
create policy "backoffice_webhook_tokens_delete" on public.backoffice_webhook_tokens for delete to authenticated
  using (public.is_active_backoffice_user());
