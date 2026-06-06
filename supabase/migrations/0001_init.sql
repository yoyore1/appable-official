-- =============================================================================
-- Appable platform — initial schema
-- Mirrors the mock data layer in src/lib/db.ts so swapping mock → Supabase is
-- a drop-in. Run in the Supabase SQL editor (or via the Supabase CLI).
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector"; -- pgvector, for the build cache

-- ---- profiles (1:1 with auth.users) ----------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  deposit_paid boolean not null default false,
  build_power integer not null default 0,
  review_balance integer not null default 0,
  data_sharing_opt_in boolean not null default false,
  is_admin boolean not null default false,
  course_tier_id text,
  created_at timestamptz not null default now()
);

-- ---- projects ---------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Untitled app',
  status text not null default 'interviewing'
    check (status in ('interviewing','ready','building','live')),
  vibe text,
  thumbnail_hue integer not null default 0,
  interview jsonb not null default '[]'::jsonb,
  master_prompt jsonb,
  launch jsonb not null default '{"purchased":false}'::jsonb,
  legal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id);

-- ---- cached_builds (pgvector) ----------------------------------------------
create table if not exists public.cached_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  category text not null,
  features text[] not null default '{}',
  vibe text,
  colors text,
  code_ref text not null,
  embedding vector(1536),         -- spec embedding for similarity search
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cached_builds_embedding_idx
  on public.cached_builds using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ---- find_similar_builds(): top-N by cosine distance, visible to the user ---
create or replace function public.find_similar_builds(
  query_embedding vector(1536),
  requesting_user uuid,
  match_count int default 5
)
returns table (
  id uuid, category text, features text[], vibe text,
  colors text, code_ref text, score float
)
language sql stable as $$
  select c.id, c.category, c.features, c.vibe, c.colors, c.code_ref,
         1 - (c.embedding <=> query_embedding) as score
  from public.cached_builds c
  where (c.shared = true or c.user_id = requesting_user)
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ---- Row Level Security -----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.cached_builds enable row level security;

create policy "own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read shared or own cache" on public.cached_builds
  for select using (shared = true or auth.uid() = user_id);

-- Create a profile row automatically on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
