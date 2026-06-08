const MANAGEMENT_BASE = "https://api.supabase.com/v1";

export interface SupabaseManagementProject {
  id: string;
  ref: string;
  name: string;
  region?: string;
  organization_id?: string;
}

export interface SupabaseApiKeys {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

async function managementFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${MANAGEMENT_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("INVALID_TOKEN");
    }
    throw new Error(
      `Supabase API ${res.status}: ${body.slice(0, 200) || res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

export async function listSupabaseProjects(
  accessToken: string
): Promise<SupabaseManagementProject[]> {
  const data = await managementFetch<
    SupabaseManagementProject[] | { projects?: SupabaseManagementProject[] }
  >("/projects", accessToken.trim());
  if (Array.isArray(data)) return data;
  return data.projects ?? [];
}

export async function fetchSupabaseApiKeys(
  accessToken: string,
  projectRef: string
): Promise<SupabaseApiKeys> {
  const raw = await managementFetch<
    | Array<{ name?: string; api_key?: string; role?: string }>
    | { api_keys?: Array<{ name?: string; api_key?: string; role?: string }> }
  >(`/projects/${projectRef}/api-keys`, accessToken.trim());

  const keys = Array.isArray(raw) ? raw : (raw.api_keys ?? []);

  let anonKey = "";
  let serviceRoleKey = "";
  for (const row of keys) {
    const name = (row.name ?? row.role ?? "").toLowerCase();
    const key = row.api_key ?? "";
    if (!key) continue;
    if (name.includes("anon") || name === "anon") anonKey = key;
    if (name.includes("service") || name === "service_role") serviceRoleKey = key;
  }

  if (!anonKey || !serviceRoleKey) {
    throw new Error("API_KEYS_INCOMPLETE");
  }

  const url = `https://${projectRef}.supabase.co`;
  return { url, anonKey, serviceRoleKey };
}

/** Run SQL on the linked project (Management API). */
export async function runSupabaseSetupSql(
  accessToken: string,
  projectRef: string,
  query: string
): Promise<void> {
  await managementFetch(`/projects/${projectRef}/database/query`, accessToken.trim(), {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export const APPABLE_SUPABASE_SETUP_SQL = `
create table if not exists public.appable_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text,
  has_completed_onboarding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appable_profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'appable_profiles' and policyname = 'appable_profiles_select_own'
  ) then
    create policy appable_profiles_select_own on public.appable_profiles
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'appable_profiles' and policyname = 'appable_profiles_insert_own'
  ) then
    create policy appable_profiles_insert_own on public.appable_profiles
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'appable_profiles' and policyname = 'appable_profiles_update_own'
  ) then
    create policy appable_profiles_update_own on public.appable_profiles
      for update using (auth.uid() = user_id);
  end if;
end $$;

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

/** In-app messaging — sender_id + text only (no read receipts for v1). */
export const APPABLE_MESSAGING_SETUP_SQL = `
create table if not exists public.appable_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  walker_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.appable_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.appable_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.appable_conversations enable row level security;
alter table public.appable_messages enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'appable_conversations' and policyname = 'appable_conversations_participant'
  ) then
    create policy appable_conversations_participant on public.appable_conversations
      for all using (auth.uid() = owner_id or auth.uid() = walker_id);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'appable_messages' and policyname = 'appable_messages_participant'
  ) then
    create policy appable_messages_participant on public.appable_messages
      for all using (
        exists (
          select 1 from public.appable_conversations c
          where c.id = conversation_id
            and (c.owner_id = auth.uid() or c.walker_id = auth.uid())
        )
      );
  end if;
end $$;
`.trim();
