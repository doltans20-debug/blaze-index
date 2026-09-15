# Blaze Index — real database-backed build

This folder is a real, deployable web app (not a chat-window demo). It's built with
React + Vite on the frontend and Supabase (hosted Postgres + Auth + Storage) on the
backend. It keeps the same black/purple/lime visual identity from the earlier prototype.

## What's real in this build
- Accounts: sign up, log in, log out, session persistence (Supabase Auth)
- Reviews: written to Postgres, one review per person per strain, editable
- Blaze Score: calculated live from real review rows by a SQL view (`strain_stats`) —
  Bayesian-damped so one perfect review can't outrank a strain with hundreds of reviews
- Rankings: live sort by score/flavour/aroma/appearance/most-reviewed; ranking movement
  (↑ / ↓ / NEW) compares against daily snapshots once you schedule `snapshot_rankings()`
- Search, strain pages, brand pages, discover, save/follow, Blaze Battle voting, profile,
  and a basic admin panel — all reading and writing the same database
- Row Level Security: people can only edit their own profile/reviews/saves/follows;
  only admins can edit brand/strain records or moderate content

## What you need to do (no coding required for this part)

### 1. Create a free Supabase project
1. Go to https://supabase.com and click "Start your project" → sign up (free tier is fine).
2. Click "New Project". Pick any name and a database password (save that password
   somewhere — you won't need it for this app, but keep it safe).
3. Wait ~2 minutes while Supabase provisions the project.

### 2. Load the database structure
1. In your new project, click "SQL Editor" in the left sidebar.
2. Click "New query".
3. Open `supabase/schema.sql` from this folder, copy its entire contents, paste it
   into the SQL Editor, and click "Run". This creates every table, security rule,
   and the Blaze Score calculation.
4. (Optional, to make the site feel populated right away) Repeat the same steps
   with `supabase/seed_demo_data.sql`. Everything it adds is tagged `is_demo = true`
   and `unverified` so it's never confused with real, verified brand data.

### 3. Get your two connection values
1. In your project, click the gear icon → "Project Settings" → "API".
2. You'll see "Project URL" — copy it.
3. You'll see "Project API keys" → copy the one labeled **anon / public**.
   **Do not copy the "service_role" key anywhere in this app — that one must
   stay secret and server-side only.**

### 4. Give the app those two values
1. In this folder, copy `.env.example` to a new file named `.env`.
2. Paste your Project URL after `VITE_SUPABASE_URL=`.
3. Paste your anon/public key after `VITE_SUPABASE_ANON_KEY=`.

### 5. Run it
If you have Node.js installed:
```
npm install
npm run dev
```
Then open the local address it prints (usually http://localhost:5173).

To put it on the real internet, the easiest path is Vercel or Netlify: create a free
account, connect this project's code (e.g. via GitHub), and add the same two
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values in that platform's
"Environment Variables" settings. Both platforms auto-detect Vite projects.

### 6. Make yourself an admin
1. Sign up for an account inside the running app.
2. Back in Supabase, go to "Table Editor" → `profiles`, find your row, and set
   `is_admin` to `true`. Save. Reload the app — the Admin panel is now unlocked
   from your profile page.

### 7. (Optional) Turn on ranking history
Rank movement (↑ 5, ↓ 2, NEW 🔥) needs a daily snapshot to compare against. In
Supabase, go to "Database" → "Cron Jobs" (or enable the `pg_cron` extension
under "Database" → "Extensions") and schedule this once a day:
```sql
select snapshot_rankings('daily');
```

## Why this isn't a Claude.ai in-chat artifact anymore
Supabase requires a real npm package and a securely-injected environment
variable — the sandboxed browser preview used for in-chat artifacts can't
install packages or hold secrets safely. This folder is meant to be run
locally or deployed properly (Vercel/Netlify), which is the correct and
standard way to ship a real Supabase-backed product.

## Honest status
**Working:** auth, reviews, live Blaze Score, rankings + sort filters, search,
strain/brand pages, discover, save/follow, Blaze Battle voting, profile, basic
admin (add strain/brand, view reports).

**Scaffolded in the schema but no UI yet:** comments on reviews, notifications,
badges display, personal Top 10 lists, brand claim review queue, CSV/JSON bulk
import for verified brand data, "Today/Week/Month" time-windowed rankings
(the SQL functions are ready; the UI currently always shows All Time).

**Needs you (non-credential decisions):** deciding who your first real,
verified brands/strains are, and whether you want moderators besides yourself.

## Next technical step I'd take
Build the CSV/JSON admin import tool (item 15/roadmap) so real brand and strain
data can be loaded in bulk with `verification_status` set correctly, plus wire
the daily ranking snapshot as a Supabase scheduled Edge Function so movement
badges are accurate without you running SQL by hand.
