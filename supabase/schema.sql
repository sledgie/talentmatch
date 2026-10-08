-- TalentMatch schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- Profiles: one row per auth.users row, created on signup
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  resume_url text,
  resume_filename text,
  resume_type text,
  resume_size bigint,
  resume_uploaded_at timestamptz,
  notify_match_ready boolean not null default true,
  notify_tips boolean not null default true,
  resume_save_preference text not null default 'ask' check (resume_save_preference in ('ask', 'always', 'never')),
  prefer_resume_email_default boolean not null default false,
  theme_id text not null default 'teal-porcelain',
  resume_builder_draft jsonb,
  created_at timestamptz not null default now()
);

-- Safe to re-run on a profiles table created before this column set existed.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists resume_filename text;
alter table public.profiles add column if not exists resume_type text;
alter table public.profiles add column if not exists resume_size bigint;
alter table public.profiles add column if not exists resume_uploaded_at timestamptz;
alter table public.profiles add column if not exists notify_match_ready boolean not null default true;
alter table public.profiles add column if not exists notify_tips boolean not null default true;
alter table public.profiles add column if not exists resume_save_preference text not null default 'ask';
alter table public.profiles add column if not exists prefer_resume_email_default boolean not null default false;
alter table public.profiles add column if not exists theme_id text not null default 'teal-porcelain';
alter table public.profiles add column if not exists resume_builder_draft jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_resume_save_preference_check
    check (resume_save_preference in ('ask', 'always', 'never'));
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter table public.profiles add constraint profiles_theme_id_check
    check (theme_id in (
      'velvet-ash', 'ember-frost', 'tidal-ivory', 'silver-meadow', 'moonlit-slate',
      'blush-silk', 'violet-grove', 'golden-moss', 'desert-merlot', 'teal-porcelain',
      'cinder-coral', 'clay-linen', 'rosewood-garden', 'midnight-gild'
    ));
exception
  when duplicate_object then null;
end $$;

-- Profile skills: one row per skill the user has
create table if not exists public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_name text not null,
  proficiency int not null check (proficiency between 0 and 100),
  created_at timestamptz not null default now()
);

-- Jobs: a job opening the user pasted
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  company text,
  location text,
  description text not null,
  created_at timestamptz not null default now()
);

-- Job requirements: individual requirement lines extracted from a job
create table if not exists public.job_requirements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  label text not null,
  category text,
  created_at timestamptz not null default now()
);

-- Analysis requests: one row per submission sent to the n8n analysis webhook
create table if not exists public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  request_id text not null,
  notify_email text not null,
  prefer_resume_email boolean not null default false,
  resume_filename text,
  status text not null default 'submitted' check (status in ('submitted', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- Comparisons: the match result once the analysis completes
create table if not exists public.comparisons (
  id uuid primary key default gen_random_uuid(),
  analysis_request_id uuid references public.analysis_requests(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  overall_score int not null check (overall_score between 0 and 100),
  created_at timestamptz not null default now()
);

-- Comparison results: one row per requirement per comparison
create table if not exists public.comparison_results (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  requirement_id uuid not null references public.job_requirements(id) on delete cascade,
  status text not null check (status in ('match', 'partial', 'missing')),
  note text,
  created_at timestamptz not null default now()
);

-- Row Level Security: every table is locked down so a user can only see
-- and modify rows tied to their own profile (profile_id / profiles.id == auth.uid()).

alter table public.profiles enable row level security;
alter table public.profile_skills enable row level security;
alter table public.jobs enable row level security;
alter table public.job_requirements enable row level security;
alter table public.analysis_requests enable row level security;
alter table public.comparisons enable row level security;
alter table public.comparison_results enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can manage their own skills"
  on public.profile_skills for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "Users can manage their own jobs"
  on public.jobs for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "Users can manage requirements for their own jobs"
  on public.job_requirements for all
  using (exists (select 1 from public.jobs where jobs.id = job_requirements.job_id and jobs.profile_id = auth.uid()))
  with check (exists (select 1 from public.jobs where jobs.id = job_requirements.job_id and jobs.profile_id = auth.uid()));

create policy "Users can manage their own analysis requests"
  on public.analysis_requests for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "Users can manage their own comparisons"
  on public.comparisons for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "Users can manage results for their own comparisons"
  on public.comparison_results for all
  using (exists (select 1 from public.comparisons where comparisons.id = comparison_results.comparison_id and comparisons.profile_id = auth.uid()))
  with check (exists (select 1 from public.comparisons where comparisons.id = comparison_results.comparison_id and comparisons.profile_id = auth.uid()));

-- Auto-create a profiles row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Resume storage: a private bucket where each user's files live under a
-- folder named after their own user id (e.g. "<uuid>/169..._resume.pdf").
-- If this insert errors in your project, create the bucket manually instead:
-- Storage > New bucket > name "resumes", uncheck "Public bucket".
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "Users can upload to their own resume folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view their own resume files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own resume files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own resume files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
