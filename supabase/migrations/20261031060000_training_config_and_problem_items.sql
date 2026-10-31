-- Global training configuration of the parent account.
alter table public.parent_settings add column config jsonb not null default '{}'::jsonb;

-- Order of lessons within a class; new lessons go last, the parent can reorder.
alter table public.lessons add column position bigint not null default ((extract(epoch from now()) * 1000)::bigint);
create index on public.lessons(grade, position);

-- The most problematic questions of each training, kept per child and lesson until mastered.
create table public.problem_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  item_type text not null check (item_type in ('vocab','grammar','sentence','pronunciation')),
  item_id uuid not null,
  label text not null,
  detail text,
  last_answer text,
  wrong_count int not null default 0,
  sessions_count int not null default 0,
  correct_streak int not null default 0,
  mastered boolean not null default false,
  mastered_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_wrong_at timestamptz,
  last_session_id uuid references public.sessions(id) on delete set null,
  constraint problem_items_unique unique (child_id, item_type, item_id)
);
create index on public.problem_items(lesson_id, mastered);
create index on public.problem_items(owner_id);
create index on public.problem_items(last_session_id);

alter table public.problem_items enable row level security;
create policy "owner_select" on public.problem_items for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner_insert" on public.problem_items for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner_update" on public.problem_items for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner_delete" on public.problem_items for delete to authenticated using (owner_id = (select auth.uid()));
