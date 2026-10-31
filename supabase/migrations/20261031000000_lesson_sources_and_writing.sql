-- Exercises transcribed from textbook photos; the parent assigns practice types to each.
create table public.lesson_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  page int not null default 1,
  label text,
  instruction text,
  content text not null,
  note text,
  types text[] not null default '{}',
  suggested text[] not null default '{}',
  applied_types text[],
  applied_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint lesson_sources_types_check check (types <@ array['vocab','grammar','reading','listening','writing','skip']::text[])
);
create index on public.lesson_sources(lesson_id, page, position);
create index on public.lesson_sources(owner_id);

alter table public.lesson_sources enable row level security;
create policy "owner_select" on public.lesson_sources for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner_insert" on public.lesson_sources for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner_update" on public.lesson_sources for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner_delete" on public.lesson_sources for delete to authenticated using (owner_id = (select auth.uid()));

-- Generated items remember which exercise they came from (so re-categorising replaces them).
alter table public.vocab_items add column source_id uuid references public.lesson_sources(id) on delete set null;
alter table public.grammar_items add column source_id uuid references public.lesson_sources(id) on delete set null;
alter table public.lesson_texts add column source_id uuid references public.lesson_sources(id) on delete set null;
create index on public.vocab_items(source_id);
create index on public.grammar_items(source_id);
create index on public.lesson_texts(source_id);

-- What a text is used for: reading, listening and/or writing (building sentences from words).
alter table public.lesson_texts add column uses text[] not null default '{reading,listening}';
alter table public.lesson_texts add constraint lesson_texts_uses_check check (uses <@ array['reading','listening','writing']::text[]);

-- Sentences (writing practice) get their own progress so mistakes come back more often.
alter table public.attempts drop constraint attempts_item_type_check;
alter table public.attempts add constraint attempts_item_type_check check (item_type in ('vocab','grammar','sentence'));
alter table public.item_progress drop constraint item_progress_item_type_check;
alter table public.item_progress add constraint item_progress_item_type_check check (item_type in ('vocab','grammar','sentence'));
