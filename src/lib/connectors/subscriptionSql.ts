/** Subscription state synced from RevenueCat webhooks into linked Supabase. */
export const APPABLE_SUBSCRIPTIONS_SETUP_SQL = `
create table if not exists public.appable_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revenuecat_app_user_id text,
  entitlement_ids text[] not null default '{}',
  is_active boolean not null default false,
  product_id text,
  store text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.appable_subscriptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'appable_subscriptions' and policyname = 'appable_subscriptions_select_own'
  ) then
    create policy appable_subscriptions_select_own on public.appable_subscriptions
      for select using (auth.uid() = user_id);
  end if;
end $$;
`.trim();
