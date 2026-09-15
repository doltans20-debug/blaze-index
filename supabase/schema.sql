-- ============================================================
-- BLAZE INDEX — Supabase / Postgres schema
-- Run this in Supabase Studio → SQL Editor (whole file, once).
--
-- IDEMPOTENT BY DESIGN: safe to paste and run again after a partial
-- or failed run, with no loss of existing data.
--   - Tables:              create table IF NOT EXISTS
--   - Indexes:             create index IF NOT EXISTS
--   - Views:                create OR REPLACE view
--   - Functions:            create OR REPLACE function
--   - Triggers:             drop trigger IF EXISTS, then create
--   - RLS policies:         drop policy IF EXISTS, then create
--     (Postgres has no "create policy if not exists" / "or replace",
--     so every policy below is preceded by its own matching drop.
--     Dropping and recreating a policy does not touch table data and
--     does not weaken security — the same rule is simply reapplied.)
--   - Row Level Security:  alter table ... enable row level security
--     (idempotent — no error if already enabled)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ENUM-ish check constraints as text (kept as text so admins can
-- extend values later without an ALTER TYPE migration)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  is_admin boolean not null default false,
  reviewer_reputation integer not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_profiles_username on profiles (username);

-- ------------------------------------------------------------
-- BREEDERS
-- ------------------------------------------------------------
create table if not exists breeders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  country text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified','brand_submitted','community_submitted','editorially_verified','unverified')),
  source text,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- GENETICS (lineage / cultivar family reference table)
-- ------------------------------------------------------------
create table if not exists genetics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  lineage text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- BRANDS
-- ------------------------------------------------------------
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  description text,
  country text,
  instagram_handle text,
  website_url text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified','brand_submitted','community_submitted','editorially_verified','unverified')),
  source text,
  source_url text,
  verified_at timestamptz,
  follower_count integer not null default 0,
  is_demo boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_brands_slug on brands (slug);
create index if not exists idx_brands_verification on brands (verification_status);

-- ------------------------------------------------------------
-- STRAINS
-- ------------------------------------------------------------
create table if not exists strains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  brand_id uuid references brands(id) on delete set null,
  breeder_id uuid references breeders(id) on delete set null,
  genetics_id uuid references genetics(id) on delete set null,
  genetics_text text,
  description text,
  image_url text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified','brand_submitted','community_submitted','editorially_verified','unverified')),
  source text,
  source_url text,
  verified_at timestamptz,
  is_demo boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_strains_slug on strains (slug);
create index if not exists idx_strains_brand on strains (brand_id);
create index if not exists idx_strains_created_at on strains (created_at desc);

create table if not exists strain_flavour_tags (
  strain_id uuid references strains(id) on delete cascade,
  tag text not null,
  primary key (strain_id, tag)
);
create table if not exists strain_aroma_tags (
  strain_id uuid references strains(id) on delete cascade,
  tag text not null,
  primary key (strain_id, tag)
);

-- ------------------------------------------------------------
-- REVIEWS
-- ------------------------------------------------------------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  strain_id uuid not null references strains(id) on delete cascade,
  flavour_rating numeric(3,1) not null check (flavour_rating between 0 and 10),
  aroma_rating numeric(3,1) not null check (aroma_rating between 0 and 10),
  appearance_rating numeric(3,1) not null check (appearance_rating between 0 and 10),
  overall_rating numeric(3,1) not null check (overall_rating between 0 and 10),
  would_blaze_again text not null check (would_blaze_again in ('definitely','probably','maybe','no')),
  written_review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, strain_id) -- one active review per user per strain; resubmission = update
);
create index if not exists idx_reviews_strain on reviews (strain_id);
create index if not exists idx_reviews_user on reviews (user_id);
create index if not exists idx_reviews_created_at on reviews (created_at desc);

create table if not exists review_flavour_tags (
  review_id uuid references reviews(id) on delete cascade,
  tag text not null,
  primary key (review_id, tag)
);
create table if not exists review_aroma_tags (
  review_id uuid references reviews(id) on delete cascade,
  tag text not null,
  primary key (review_id, tag)
);
create table if not exists review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists helpful_votes (
  review_id uuid references reviews(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_review on comments (review_id);

-- ------------------------------------------------------------
-- SOCIAL GRAPH
-- ------------------------------------------------------------
create table if not exists followers (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table if not exists followed_brands (
  user_id uuid references profiles(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);
create table if not exists saved_strains (
  user_id uuid references profiles(id) on delete cascade,
  strain_id uuid references strains(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, strain_id)
);

-- ------------------------------------------------------------
-- BLAZE BATTLES
-- ------------------------------------------------------------
create table if not exists blaze_battles (
  id uuid primary key default gen_random_uuid(),
  strain_a_id uuid not null references strains(id),
  strain_b_id uuid not null references strains(id),
  round text not null default 'Round of 16',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists battle_votes (
  battle_id uuid references blaze_battles(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  strain_id uuid references strains(id),
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);

-- ------------------------------------------------------------
-- RANKING HISTORY (populated by a scheduled snapshot function / pg_cron)
-- ------------------------------------------------------------
create table if not exists ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period in ('daily','weekly','monthly','all_time')),
  snapshot_date date not null default current_date,
  strain_id uuid not null references strains(id) on delete cascade,
  rank integer not null,
  blaze_score numeric not null,
  created_at timestamptz not null default now(),
  unique (period, snapshot_date, strain_id)
);
create index if not exists idx_ranking_snapshots_lookup on ranking_snapshots (period, snapshot_date, strain_id);

-- ------------------------------------------------------------
-- MODERATION
-- ------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  target_type text not null check (target_type in ('review','strain','brand','comment')),
  target_id uuid not null,
  reason text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);

create table if not exists brand_claims (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references profiles(id),
  evidence text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

-- ------------------------------------------------------------
-- NOTIFICATIONS / BADGES
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications (user_id, is_read);

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  icon text
);
create table if not exists user_badges (
  user_id uuid references profiles(id) on delete cascade,
  badge_id uuid references badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ============================================================
-- BLAZE SCORE — live view, Bayesian-damped + recency weighted
-- so one perfect review can't outrank a strain with hundreds
-- of strong reviews.
-- ============================================================
create or replace view strain_stats as
select
  s.id as strain_id,
  count(r.id) as review_count,
  coalesce(avg(r.flavour_rating), 0) as avg_flavour,
  coalesce(avg(r.aroma_rating), 0) as avg_aroma,
  coalesce(avg(r.appearance_rating), 0) as avg_appearance,
  coalesce(avg(r.overall_rating), 0) as avg_overall,
  coalesce(
    round(
      100.0 * count(*) filter (where r.would_blaze_again in ('definitely','probably'))
      / nullif(count(r.id), 0)
    ), 0
  ) as would_again_pct,
  case when count(r.id) = 0 then null else
    round(
      -- Bayesian-damped average (prior C=70, confidence threshold M=8)
      ( (count(r.id)::numeric / (count(r.id) + 8)) * (avg(r.overall_rating) * 10)
        + (8.0 / (count(r.id) + 8)) * 70 ) * 0.82
      +
      -- recency-weighted average (reviews under 14 days count 1.35x)
      ( sum(r.overall_rating * 10 * case when r.created_at > now() - interval '14 days' then 1.35 else 1 end)
        / nullif(sum(case when r.created_at > now() - interval '14 days' then 1.35 else 1 end), 0)
      ) * 0.18
    )
  end as blaze_score
from strains s
left join reviews r on r.strain_id = s.id
group by s.id;

-- helper function so the frontend can call one RPC instead of a raw view
-- (also lets us add caching/materialization later without an API change)
create or replace function get_strain_stats(p_strain_id uuid)
returns table (
  strain_id uuid, review_count bigint, avg_flavour numeric, avg_aroma numeric,
  avg_appearance numeric, avg_overall numeric, would_again_pct numeric, blaze_score numeric
) language sql stable as $$
  select * from strain_stats where strain_id = p_strain_id;
$$;

-- ranking movement: compare latest two snapshots for a period
create or replace function get_ranking_movement(p_period text)
returns table (strain_id uuid, current_rank bigint, previous_rank integer)
language sql stable as $$
  with ranked as (
    select ss.strain_id, row_number() over (order by ss.blaze_score desc nulls last) as current_rank
    from strain_stats ss
  ),
  latest_two_dates as (
    select distinct snapshot_date from ranking_snapshots
    where period = p_period order by snapshot_date desc limit 1
  )
  select r.strain_id, r.current_rank, rs.rank as previous_rank
  from ranked r
  left join ranking_snapshots rs
    on rs.strain_id = r.strain_id and rs.period = p_period
    and rs.snapshot_date = (select snapshot_date from latest_two_dates);
$$;

-- call this once a day (e.g. via pg_cron or a Supabase Edge Function on a schedule)
-- to persist a rank snapshot so movement (↑ ↓ NEW) has real history to compare against.
create or replace function snapshot_rankings(p_period text)
returns void language plpgsql as $$
begin
  insert into ranking_snapshots (period, snapshot_date, strain_id, rank, blaze_score)
  select p_period, current_date, ss.strain_id,
         row_number() over (order by ss.blaze_score desc nulls last),
         coalesce(ss.blaze_score, 0)
  from strain_stats ss
  on conflict (period, snapshot_date, strain_id) do update
    set rank = excluded.rank, blaze_score = excluded.blaze_score;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_reviews_updated_at on reviews;
create trigger trg_reviews_updated_at before update on reviews
  for each row execute function set_updated_at();

-- keep profiles.review_count roughly in sync (cheap denormalization for profile UI)
create or replace function bump_review_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update profiles set review_count = review_count + 1 where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update profiles set review_count = greatest(0, review_count - 1) where id = old.user_id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_bump_review_count on reviews;
create trigger trg_bump_review_count after insert or delete on reviews
  for each row execute function bump_review_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table brands enable row level security;
alter table strains enable row level security;
alter table strain_flavour_tags enable row level security;
alter table strain_aroma_tags enable row level security;
alter table reviews enable row level security;
alter table review_flavour_tags enable row level security;
alter table review_aroma_tags enable row level security;
alter table review_images enable row level security;
alter table helpful_votes enable row level security;
alter table comments enable row level security;
alter table followers enable row level security;
alter table followed_brands enable row level security;
alter table saved_strains enable row level security;
alter table blaze_battles enable row level security;
alter table battle_votes enable row level security;
alter table ranking_snapshots enable row level security;
alter table reports enable row level security;
alter table brand_claims enable row level security;
alter table notifications enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;
alter table breeders enable row level security;
alter table genetics enable row level security;

-- small helper used inside policies
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- PROFILES: public read, owner-or-admin write
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin" on profiles for update using (auth.uid() = id or is_admin());

-- BRANDS / STRAINS: public read; community members can submit (flagged community_submitted);
-- only admins can edit/verify existing records
drop policy if exists "brands_select_all" on brands;
create policy "brands_select_all" on brands for select using (true);
drop policy if exists "brands_insert_auth" on brands;
create policy "brands_insert_auth" on brands for insert with check (auth.uid() is not null);
drop policy if exists "brands_update_admin" on brands;
create policy "brands_update_admin" on brands for update using (is_admin());
drop policy if exists "strains_select_all" on strains;
create policy "strains_select_all" on strains for select using (true);
drop policy if exists "strains_insert_auth" on strains;
create policy "strains_insert_auth" on strains for insert with check (auth.uid() is not null);
drop policy if exists "strains_update_admin" on strains;
create policy "strains_update_admin" on strains for update using (is_admin());
drop policy if exists "strain_flavour_tags_select_all" on strain_flavour_tags;
create policy "strain_flavour_tags_select_all" on strain_flavour_tags for select using (true);
drop policy if exists "strain_flavour_tags_write_admin" on strain_flavour_tags;
create policy "strain_flavour_tags_write_admin" on strain_flavour_tags for all using (is_admin()) with check (is_admin());
drop policy if exists "strain_aroma_tags_select_all" on strain_aroma_tags;
create policy "strain_aroma_tags_select_all" on strain_aroma_tags for select using (true);
drop policy if exists "strain_aroma_tags_write_admin" on strain_aroma_tags;
create policy "strain_aroma_tags_write_admin" on strain_aroma_tags for all using (is_admin()) with check (is_admin());

-- REVIEWS: public read; owner writes own only; admin can delete for moderation
drop policy if exists "reviews_select_all" on reviews;
create policy "reviews_select_all" on reviews for select using (true);
drop policy if exists "reviews_insert_own" on reviews;
create policy "reviews_insert_own" on reviews for insert with check (auth.uid() = user_id);
drop policy if exists "reviews_update_own" on reviews;
create policy "reviews_update_own" on reviews for update using (auth.uid() = user_id);
drop policy if exists "reviews_delete_own_or_admin" on reviews;
create policy "reviews_delete_own_or_admin" on reviews for delete using (auth.uid() = user_id or is_admin());

drop policy if exists "review_flavour_tags_select_all" on review_flavour_tags;
create policy "review_flavour_tags_select_all" on review_flavour_tags for select using (true);
drop policy if exists "review_flavour_tags_owner" on review_flavour_tags;
create policy "review_flavour_tags_owner" on review_flavour_tags for all
  using (exists(select 1 from reviews r where r.id = review_id and r.user_id = auth.uid()) or is_admin())
  with check (exists(select 1 from reviews r where r.id = review_id and r.user_id = auth.uid()));
drop policy if exists "review_aroma_tags_select_all" on review_aroma_tags;
create policy "review_aroma_tags_select_all" on review_aroma_tags for select using (true);
drop policy if exists "review_aroma_tags_owner" on review_aroma_tags;
create policy "review_aroma_tags_owner" on review_aroma_tags for all
  using (exists(select 1 from reviews r where r.id = review_id and r.user_id = auth.uid()) or is_admin())
  with check (exists(select 1 from reviews r where r.id = review_id and r.user_id = auth.uid()));
drop policy if exists "review_images_select_all" on review_images;
create policy "review_images_select_all" on review_images for select using (true);
drop policy if exists "review_images_owner" on review_images;
create policy "review_images_owner" on review_images for all
  using (exists(select 1 from reviews r where r.id = review_id and r.user_id = auth.uid()) or is_admin())
  with check (exists(select 1 from reviews r where r.id = review_id and r.user_id = auth.uid()));

-- HELPFUL VOTES / COMMENTS
drop policy if exists "helpful_votes_select_all" on helpful_votes;
create policy "helpful_votes_select_all" on helpful_votes for select using (true);
drop policy if exists "helpful_votes_own" on helpful_votes;
create policy "helpful_votes_own" on helpful_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "comments_select_all" on comments;
create policy "comments_select_all" on comments for select using (true);
drop policy if exists "comments_insert_own" on comments;
create policy "comments_insert_own" on comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments_delete_own_or_admin" on comments;
create policy "comments_delete_own_or_admin" on comments for delete using (auth.uid() = user_id or is_admin());

-- SOCIAL GRAPH
drop policy if exists "followers_select_all" on followers;
create policy "followers_select_all" on followers for select using (true);
drop policy if exists "followers_own" on followers;
create policy "followers_own" on followers for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
drop policy if exists "followed_brands_select_all" on followed_brands;
create policy "followed_brands_select_all" on followed_brands for select using (true);
drop policy if exists "followed_brands_own" on followed_brands;
create policy "followed_brands_own" on followed_brands for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "saved_strains_select_own" on saved_strains;
create policy "saved_strains_select_own" on saved_strains for select using (auth.uid() = user_id);
drop policy if exists "saved_strains_own" on saved_strains;
create policy "saved_strains_own" on saved_strains for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- BATTLES
drop policy if exists "battles_select_all" on blaze_battles;
create policy "battles_select_all" on blaze_battles for select using (true);
drop policy if exists "battles_write_admin" on blaze_battles;
create policy "battles_write_admin" on blaze_battles for all using (is_admin()) with check (is_admin());
drop policy if exists "battle_votes_select_all" on battle_votes;
create policy "battle_votes_select_all" on battle_votes for select using (true);
drop policy if exists "battle_votes_own" on battle_votes;
create policy "battle_votes_own" on battle_votes for insert with check (auth.uid() = user_id);

-- RANKING SNAPSHOTS: public read, system/admin write
drop policy if exists "ranking_snapshots_select_all" on ranking_snapshots;
create policy "ranking_snapshots_select_all" on ranking_snapshots for select using (true);
drop policy if exists "ranking_snapshots_write_admin" on ranking_snapshots;
create policy "ranking_snapshots_write_admin" on ranking_snapshots for all using (is_admin()) with check (is_admin());

-- REPORTS: reporter can insert & see own; admins see/manage all
drop policy if exists "reports_insert_own" on reports;
create policy "reports_insert_own" on reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "reports_select_own_or_admin" on reports;
create policy "reports_select_own_or_admin" on reports for select using (auth.uid() = reporter_id or is_admin());
drop policy if exists "reports_update_admin" on reports;
create policy "reports_update_admin" on reports for update using (is_admin());

-- BRAND CLAIMS
drop policy if exists "brand_claims_insert_own" on brand_claims;
create policy "brand_claims_insert_own" on brand_claims for insert with check (auth.uid() = user_id);
drop policy if exists "brand_claims_select_own_or_admin" on brand_claims;
create policy "brand_claims_select_own_or_admin" on brand_claims for select using (auth.uid() = user_id or is_admin());
drop policy if exists "brand_claims_update_admin" on brand_claims;
create policy "brand_claims_update_admin" on brand_claims for update using (is_admin());

-- NOTIFICATIONS: strictly own
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update using (auth.uid() = user_id);

-- BADGES: public read; admin write
drop policy if exists "badges_select_all" on badges;
create policy "badges_select_all" on badges for select using (true);
drop policy if exists "badges_write_admin" on badges;
create policy "badges_write_admin" on badges for all using (is_admin()) with check (is_admin());
drop policy if exists "user_badges_select_all" on user_badges;
create policy "user_badges_select_all" on user_badges for select using (true);
drop policy if exists "user_badges_write_admin" on user_badges;
create policy "user_badges_write_admin" on user_badges for all using (is_admin()) with check (is_admin());

-- BREEDERS / GENETICS: public read, admin write
drop policy if exists "breeders_select_all" on breeders;
create policy "breeders_select_all" on breeders for select using (true);
drop policy if exists "breeders_write_admin" on breeders;
create policy "breeders_write_admin" on breeders for all using (is_admin()) with check (is_admin());
drop policy if exists "genetics_select_all" on genetics;
create policy "genetics_select_all" on genetics for select using (true);
drop policy if exists "genetics_write_admin" on genetics;
create policy "genetics_write_admin" on genetics for all using (is_admin()) with check (is_admin());

-- ============================================================
-- Auto-create a profile row whenever someone signs up via Supabase Auth
-- ============================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'blazer_' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'username', 'New Blazer')
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
