# Veil — Wedding Photography Studio OS
## Complete Project Brief for Claude Code

---

## What We're Building

**Veil** is a verticalized SaaS platform ("studio OS") for independent wedding photographers. Think Honeybook/Dubsado but rebuilt from scratch specifically for wedding photographers, with deep AI integration and wedding-specific features that general CRMs will never build.

**Tagline:** "The studio OS for wedding photographers."

**Target user:** Independent wedding photographers (solo or small studio, 20–60 weddings/year). First user is a real photographer — the developer's father — which gives direct access to feedback throughout development.

**Stack:** Next.js (App Router) + Supabase + Claude API (Anthropic)

**Competitive gap:** Existing tools (Honeybook, Dubsado, 17Hats) are general-purpose CRMs photographers hack together. None have AI built in meaningfully. None have day-of tools. None understand the wedding photography workflow end to end.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | Server actions for Supabase mutations |
| Backend/DB | Supabase | Postgres, Auth, Storage, Realtime, pg_cron |
| AI | Claude API (`claude-sonnet-4-5` or latest Sonnet) | All AI features route through Anthropic |
| Styling | Tailwind CSS | |
| Deployment | Vercel | |
| Gallery integration | Pixieset / Pic-Time webhooks | Don't build gallery delivery — integrate instead |
| Maps | Google Maps API + Distance Matrix API | Venue coords, drive time, scouting pins |
| Sunset API | sunrise-sunset.org (free) | Golden hour calculation from lat/lng + date |
| Social | Instagram Graph API | Publishing only, no TikTok for now |

---

## Feature Set & Build Priority

### Tier 1 — MVP ✅ COMPLETE

1. **Auth + photographer onboarding** ✅ BUILT
   - Supabase Auth (email/password + magic link)
   - Onboarding: studio name, style notes, upload 3–5 sample emails for AI tone matching
   - `photographers` table row created on first login
   - Files: `app/login/`, `app/onboarding/`, `app/actions/auth.ts`, `app/auth/callback/`

2. **Smart client intake** ✅ BUILT
   - Photographer fills this in after discovery call with couple (NOT couple self-serve)
   - Conditional logic form: questions branch based on answers
   - Captures: couple names, wedding date, venue(s), family structure, wedding party, style preferences, special requests, referral source
   - Family structure input is critical — needed for shot list generation
   - On venue address entry: auto-geocode via Maps API, auto-fetch golden hour time via sunset API, store lat/lng
   - Files: `app/weddings/new/`, `app/actions/weddings.ts`

3. **Client CRM + lead pipeline** ✅ BUILT
   - Kanban-style pipeline: Inquiry → Consultation → Booked → Active → Delivered → Archived
   - Each card = one wedding record
   - Client contact info, referral source tracking (which past client referred them)
   - Files: `app/dashboard/`, `components/kanban.tsx`

4. **AI email ghostwriter** ✅ BUILT
   - Few-shot prompting: photographer's uploaded sample emails injected into system prompt with prompt caching
   - Drafts replies in photographer's own tone and voice
   - Use cases: inquiry response, booking confirmation, 2-week check-in, gallery delivery notice, anniversary outreach
   - Draft stored in `ai_drafts` table with status lifecycle: draft → approved → sent
   - Files: `app/weddings/[id]/ai/`, `app/actions/ai.ts`

5. **Wedding day timeline builder** ✅ BUILT
   - AI generates suggested timeline from: wedding date, venue(s), golden hour time (auto-populated), drive time between venues (Maps Distance Matrix API), wedding party size
   - Drag-and-drop reordering (HTML5 native)
   - Golden hour portrait block auto-scheduled 45 min before sunset
   - Drive time buffer auto-inserted if ceremony/reception are different venues
   - Files: `app/weddings/[id]/timeline/`, `app/actions/timeline.ts`

6. **Shot list generator + second shooter mobile checklist** ✅ BUILT
   - AI generates complete shot list from family structure data entered in intake
   - Family formals ordered strategically: largest groups first (so people can be released), immediate family last
   - `divorced_from` FK on `family_members` table — AI automatically separates divorced parents into different groupings without manual input
   - Mobility-limited flag on family members — their shots scheduled first
   - Second shooter access: photographer generates a PIN → second shooter opens a mobile-optimized PWA URL (no app install, no account) → sees swipeable checklist
   - Checklist works offline (service worker + localStorage cache)
   - Optimistic updates with queued sync on reconnect; `completed_by` and `completed_at` stored per item
   - Files: `app/weddings/[id]/shot-list/`, `app/checklist/[weddingId]/`, `app/api/checklist/`, `app/actions/shot-list.ts`, `public/sw.js`

### Tier 2 — Launch + 4 weeks

7. **AI quote builder** (~3 days)
   - Smart package suggestions based on: wedding date, day of week, season, venue distance, wedding party size, hours requested, style complexity
   - Output: itemized quote with package options
   - Stored as `ai_draft` of type `quote`

8. **Anniversary + milestone tracker** (~3 days)
   - On wedding record creation: auto-insert milestone rows for 1yr, 5yr, 10yr anniversaries
   - Supabase `pg_cron` job runs nightly: finds milestones with `trigger_date = today` and `notified = false`
   - Creates a `scheduled_jobs` row → triggers AI to draft an anniversary outreach email in photographer's voice
   - Photographer gets notified to review + send
   - Word-of-mouth driver: photographer who reaches out on anniversary = referrals

9. **Instagram publishing** (~5 days)
   - Instagram Graph API OAuth flow (requires Facebook Developer App + review)
   - After gallery delivery: photographer selects photos, AI drafts caption + hashtags in their brand voice using wedding details
   - Scheduling: pick a date/time, Veil publishes via API
   - `ig_posts` table tracks status: draft → scheduled → published
   - `ig_media_id` stored for reference

10. **Vendor contact hub** (~2 days)
    - Per-wedding vendor list: planner, florist, DJ, officiant, caterer, etc.
    - Role, name, phone, email, notes
    - One-tap call/navigate on mobile
    - Shared read access to second shooter via same PIN link

11. **AI blog post generator** (~3 days)
    - Triggered after gallery delivery
    - Input: wedding details (venue, style, couple names, location), selected gallery photo URLs
    - Output: SEO-optimized blog post draft targeting "[venue name] wedding photographer" and "[city] wedding photographer" keywords
    - Stored as `ai_draft` of type `blog_post`
    - Note: photographers have contractual rights to use wedding photos for marketing — this is standard industry practice

### Tier 3 — v2 (post-traction)

12. **Review request automation** — timed email ask for Google/The Knot review, 3 days after gallery delivery
13. **Referral source tracking** — log which past client referred each new booking, measure word-of-mouth ROI
14. **Pixieset / Pic-Time webhook integration** — on gallery delivered event: start anniversary clock, queue review request, unlock blog draft, queue Instagram draft
15. **Gallery engagement data loop** — pull which photos couple favorited from Pic-Time, feed into Instagram post suggestions and print upsell trigger

### Skip / Don't Build
- **Gallery delivery portal** — don't build this. Integrate with Pixieset instead. Building your own would take 6+ weeks and still be worse.
- **TikTok integration** — API approval process is slow and uncertain. Post-traction only.

---

## Database Schema (Supabase / Postgres)

All tables use UUID primary keys (`gen_random_uuid()`). Row Level Security (RLS) is enabled on all tables. Every table with `photographer_id` uses the same RLS pattern — photographers can only see their own data.

### Core tables

```sql
create table photographers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  studio_name text,
  email text not null,
  style_notes text,
  ig_access_token text,
  pixieset_webhook_secret text,
  created_at timestamptz default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  referral_source text,         -- 'past_client' | 'instagram' | 'google' | 'vendor' | 'other'
  referral_client_id uuid references clients(id),  -- if referred by past client
  created_at timestamptz default now()
);

create table weddings (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  client1_id uuid references clients(id),   -- avoids bride/groom assumption
  client2_id uuid references clients(id),
  wedding_date date,
  status text default 'inquiry',            -- 'inquiry'|'consultation'|'booked'|'active'|'delivered'|'archived'
  venue_name text,
  venue_address text,
  venue_lat float,
  venue_lng float,
  ceremony_address text,                    -- null if same as venue
  ceremony_lat float,
  ceremony_lng float,
  golden_hour_time time,                    -- auto-populated from sunset API on address entry
  drive_time_minutes integer,               -- auto-populated from Maps Distance Matrix if venues differ
  style_vibe text,                          -- photographer's notes on couple's style preferences
  special_requests text,
  pixieset_gallery_id text,
  gallery_delivered_at timestamptz,
  created_at timestamptz default now()
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  side text not null,           -- 'client1' | 'client2'
  role text not null,           -- 'parent' | 'sibling' | 'grandparent' | 'step_parent' etc
  first_name text not null,
  last_name text,
  mobility_limited boolean default false,
  divorced_from uuid references family_members(id)   -- self-referencing FK; shot list AI uses this to separate groupings
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  role text not null,           -- 'planner' | 'florist' | 'dj' | 'officiant' | 'caterer' | 'videographer' etc
  name text not null,
  phone text,
  email text,
  notes text
);

create table second_shooters (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text not null,
  pin_hash text not null        -- bcrypt hash; PIN verified server-side, no full auth needed
);
```

### Workflow tables

```sql
create table shot_list_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  sort_order integer not null,
  grouping_label text not null, -- e.g. "Bride + both parents + all siblings"
  notes text,
  completed boolean default false,
  completed_by uuid references second_shooters(id),
  completed_at timestamptz
);

create table timeline_blocks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  sort_order integer not null,
  label text not null,
  start_time time not null,
  duration_minutes integer not null,
  location text,
  notes text
);
```

### AI tables

```sql
-- Few-shot email samples uploaded at onboarding; persists across all weddings for this photographer
create table email_samples (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  subject text,
  body text not null,
  tone_tags text,               -- optional: 'warm' | 'professional' | 'casual' etc
  created_at timestamptz default now()
);

-- Single table for all AI-generated content
create table ai_drafts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  photographer_id uuid references photographers(id) on delete cascade,
  draft_type text not null,     -- 'email' | 'blog_post' | 'instagram_caption' | 'quote' | 'anniversary_email'
  content text not null,
  status text default 'draft',  -- 'draft' | 'approved' | 'sent' | 'published'
  created_at timestamptz default now()
);
```

### Automation tables

```sql
-- pg_cron target table; all scheduled background work goes here
create table scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  photographer_id uuid references photographers(id) on delete cascade,
  job_type text not null,       -- 'anniversary_reminder' | 'review_request' | 'ig_publish' | 'blog_draft'
  run_at timestamptz not null,
  status text default 'pending',-- 'pending' | 'running' | 'done' | 'failed'
  payload jsonb default '{}'    -- job-specific context, e.g. { "year": 1, "draft_type": "anniversary_email" }
);

-- Anniversary and milestone tracker
create table milestones (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  milestone_type text not null, -- 'anniversary_1yr' | 'anniversary_5yr' | 'anniversary_10yr'
  trigger_date date not null,
  notified boolean default false,
  notified_at timestamptz
);

-- Instagram posts
create table ig_posts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  photographer_id uuid references photographers(id) on delete cascade,
  caption text,
  hashtags text,
  image_urls text[],
  status text default 'draft',  -- 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_at timestamptz,
  ig_media_id text,             -- returned by Instagram API after publish
  created_at timestamptz default now()
);
```

### RLS policies

```sql
-- Enable RLS on all tables
alter table photographers enable row level security;
alter table clients enable row level security;
alter table weddings enable row level security;
alter table family_members enable row level security;
alter table vendors enable row level security;
alter table second_shooters enable row level security;
alter table shot_list_items enable row level security;
alter table timeline_blocks enable row level security;
alter table email_samples enable row level security;
alter table ai_drafts enable row level security;
alter table scheduled_jobs enable row level security;
alter table milestones enable row level security;
alter table ig_posts enable row level security;

-- Photographers: own row only
create policy "own_photographer_row" on photographers
  for all using (auth.uid() = auth_user_id);

-- Helper: get photographer id for current user
-- Use this pattern for all child tables:
create policy "own_weddings" on weddings
  for all using (
    photographer_id in (
      select id from photographers where auth_user_id = auth.uid()
    )
  );

-- For tables that only have wedding_id (family_members, vendors, etc), join through weddings:
create policy "own_family_members" on family_members
  for all using (
    wedding_id in (
      select id from weddings where photographer_id in (
        select id from photographers where auth_user_id = auth.uid()
      )
    )
  );
-- Repeat this pattern for: vendors, second_shooters, shot_list_items, timeline_blocks, milestones

-- Tables with direct photographer_id: clients, email_samples, ai_drafts, scheduled_jobs, ig_posts
-- Use same pattern as weddings above
```

---

## AI Integration Details

### Model
Always use `claude-sonnet-4-5` (or latest claude-sonnet). Do not use Opus for this — cost would be prohibitive at scale. Haiku is fine for simple classifications.

### API call pattern (Next.js server action)
```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  }),
});
const data = await response.json();
const text = data.content[0].text;
```

### Few-shot email ghostwriter
System prompt pattern:
```
You are a writing assistant for {studio_name}, a wedding photography studio.
Your job is to draft emails in the photographer's exact voice and tone.

Here are examples of how this photographer writes:

---
Subject: {sample_1_subject}
{sample_1_body}
---
Subject: {sample_2_subject}
{sample_2_body}
---
Subject: {sample_3_subject}
{sample_3_body}
---

Match this tone, vocabulary, formality level, sign-off style, and any recurring phrases exactly.
Now draft an email for the following situation:
```

Pull the 3 most recent `email_samples` for the photographer and inject them above. The model will closely mirror the photographer's voice.

### Shot list generator
Feed the AI the full family structure as structured JSON, then ask it to output a JSON array of shot groupings. Parse and insert directly into `shot_list_items`.

```
Given this family structure for {client1_name} & {client2_name}'s wedding:
{family_members_json}

Generate a complete ordered shot list for family formals. Rules:
- Order from largest group to smallest so guests can be released
- Separate any members marked as divorced_from each other into different shots
- Schedule mobility_limited members in the first 3 shots
- Include both sides of the family, then combined groups
- Output as a JSON array: [{ "sort_order": 1, "grouping_label": "...", "notes": "..." }]
- Output JSON only, no preamble
```

### AI blog post generator
```
You are an SEO copywriter for a wedding photography studio.
Write a blog post for {studio_name} about a recent wedding.

Wedding details:
- Couple: {client1_name} & {client2_name}
- Date: {wedding_date}
- Venue: {venue_name}, {venue_address}
- Style: {style_vibe}
- Special moments: {special_requests}

SEO targets:
- Primary keyword: "{venue_name} wedding photographer"
- Secondary keyword: "{city} wedding photographer"

Format: Markdown. Include H2 subheadings. 400–600 words. Warm, editorial tone.
Do not fabricate specific details not provided above.
```

### Instagram caption generator
```
Write an Instagram caption for {studio_name}'s post about {client1_name} & {client2_name}'s wedding at {venue_name}.
Style: {style_vibe}
Photographer's voice (match this tone): {email_sample_excerpt}
End with 15–20 relevant hashtags.
Keep caption under 200 words before hashtags.
```

---

## Key External API Integrations

### Google Maps
- **Geocoding API** — convert venue address to lat/lng on wedding record save
- **Distance Matrix API** — calculate drive time between ceremony and reception venues if different
- **Maps JavaScript API** — venue scouting pin map inside wedding detail view (photographer drops pins for golden hour spots, backup locations)
- Env var: `GOOGLE_MAPS_API_KEY`

### Sunset / Golden Hour
- **API:** `https://api.sunrise-sunset.org/json?lat={lat}&lng={lng}&date={YYYY-MM-DD}&formatted=0`
- Free, no key required
- Returns sunset time in UTC — convert to local timezone using venue coordinates
- Store result in `weddings.golden_hour_time`
- Golden hour = sunset minus 45 minutes (use this for auto-scheduling the portrait block)

### Instagram Graph API
- Requires Facebook Developer App with `instagram_basic` and `instagram_content_publish` permissions
- OAuth flow: photographer connects their Instagram business/creator account in settings
- Store access token in `photographers.ig_access_token` (encrypt at rest)
- Publish flow: upload photo → create media container → publish container
- Env vars: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
- Note: requires Facebook App Review before going live — start this early, approval can take 1–2 weeks

### Pixieset / Pic-Time (Tier 2)
- Pixieset has a webhook on gallery publish event
- Store `pixieset_webhook_secret` on photographer record for signature verification
- On webhook receipt: set `weddings.gallery_delivered_at = now()`, insert milestone rows, queue `scheduled_jobs` rows for review request (+3 days) and anniversary reminders (+1yr, +5yr, +10yr)

### Supabase Realtime (second shooter sync)
```typescript
// Lead photographer subscribes to shot list completions
const channel = supabase
  .channel(`shot-list-${weddingId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'shot_list_items',
    filter: `wedding_id=eq.${weddingId}`
  }, (payload) => {
    // update UI in real time
  })
  .subscribe()
```

### Supabase pg_cron (automation)
```sql
-- Run every hour, process pending scheduled jobs
select cron.schedule(
  'process-scheduled-jobs',
  '0 * * * *',
  $$
    select process_scheduled_jobs();
  $$
);
```
Create a `process_scheduled_jobs()` Postgres function (or use a Supabase Edge Function) that queries `scheduled_jobs` where `run_at <= now() AND status = 'pending'`, processes each job type, marks as done.

---

## Second Shooter Mobile PWA

This is a key differentiator — needs to feel native on mobile.

- Route: `/checklist/[weddingId]?pin=[pin]` — no login, PIN verified server-side
- Server verifies PIN against `bcrypt.compare(pin, second_shooters.pin_hash)`
- If valid: returns shot list items for that wedding
- UI: full-screen swipeable cards, large tap targets, high contrast
- Service worker caches the shot list on load — works offline
- When a shot is tapped complete: optimistic UI update + queue sync for when reconnected
- Uses `navigator.onLine` to detect offline state
- On reconnect: flush queued completions to Supabase in one batch

---

## Application Routes (Next.js App Router)

```
/                           → Marketing landing page
/login                      → Supabase Auth UI
/onboarding                 → First-time setup (studio name, email samples)
/dashboard                  → Pipeline kanban view (all weddings by status)
/weddings/new               → Create new wedding + client intake form
/weddings/[id]              → Wedding detail view (hub for all features)
/weddings/[id]/timeline     → Timeline builder
/weddings/[id]/shot-list    → Shot list generator + management
/weddings/[id]/vendors      → Vendor contact hub
/weddings/[id]/ai           → AI drafts (email, blog, quote, IG caption)
/weddings/[id]/instagram    → Instagram post composer + scheduler
/clients                    → Client CRM list view
/clients/[id]               → Client detail + wedding history
/settings                   → Studio profile, email samples, integrations
/settings/integrations      → Instagram OAuth, Pixieset webhook setup
/checklist/[weddingId]      → Second shooter PWA (public, PIN-gated)
```

---

## Environment Variables Needed

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never expose to client

# AI
ANTHROPIC_API_KEY=

# Google Maps
GOOGLE_MAPS_API_KEY=

# Instagram
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# Encryption (for storing IG access tokens)
ENCRYPTION_KEY=                  # 32-byte hex string for AES-256
```

---

## Important Design Decisions to Preserve

1. **Questionnaire/intake is filled by photographer, not couple.** Couple shares info over phone or in person; photographer enters it into Veil. This is intentional — couples paying $3–5k don't want to fill out forms.

2. **`client1` / `client2` naming, not bride/groom.** Gender-neutral throughout. Both clients are first-class records in the CRM.

3. **`divorced_from` is a self-referencing FK on `family_members`.** This single field is what makes the shot list generator automatically handle complex family dynamics without manual rules.

4. **All AI output goes through the `ai_drafts` table.** Photographer always reviews before anything is sent or published. Never auto-send without approval.

5. **Gallery delivery is NOT built.** Integrate with Pixieset/Pic-Time via webhook instead. Do not build photo storage or delivery infrastructure.

6. **Second shooter auth is PIN-based, not Supabase Auth.** They get a URL + 4-digit PIN. No account creation. PIN is bcrypt-hashed in the database.

7. **RLS is the security layer.** Every table has RLS enabled. Never query Supabase from the client without relying on RLS. The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — only use it in server-side Edge Functions or API routes, never in client code.

8. **Golden hour is auto-calculated.** When a venue address is saved, immediately call the Geocoding API (lat/lng) and Sunrise-Sunset API (sunset time for wedding date). Store `golden_hour_time = sunset - 45min` on the wedding record. Timeline builder uses this to auto-place the portrait block.

---

## Build Status

### ✅ Done — Tier 1 complete
All 6 Tier 1 features are built and the production build is clean. The Next.js app lives at `veil/` (subdirectory of this repo).

**To run locally:**
1. Copy `veil/.env.local.example` → `veil/.env.local` and fill in all values
2. Run the SQL schema in the Supabase SQL editor (see Database Schema section above)
3. `cd veil && npm run dev`

### 🔜 Next — Tier 2 (in order)
7. AI quote builder (`/weddings/[id]/ai` — add `quote` draft type)
8. Anniversary + milestone tracker (pg_cron + scheduled_jobs processor)
9. Instagram publishing (`/weddings/[id]/instagram`, Instagram Graph API OAuth)
10. Vendor contact hub (`/weddings/[id]/vendors`)
11. AI blog post generator (add `blog_post` draft type to AI drafts page)

---

## Security Requirements (Non-Negotiable)

Security is a top priority throughout this entire codebase. Every feature must be built with the following rules enforced from day one. Do not defer security to later — implement it correctly the first time.

### API Key Management

- **Never expose any API key to the client (browser).** All API keys (`ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `INSTAGRAM_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) must only exist in server-side code — Next.js Server Actions, Route Handlers (`/app/api/`), or Edge Functions.
- In Next.js, only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never prefix sensitive keys with `NEXT_PUBLIC_`. The only variables that should be `NEXT_PUBLIC_` are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — these are safe because Supabase's anon key is designed to be public and RLS enforces access control.
- Never hardcode any API key, secret, or credential directly in source code. All secrets live exclusively in `.env.local` (local dev) and Vercel environment variables (production).
- Add `.env.local` to `.gitignore` immediately. Never commit it.
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely — only use it in server-side Edge Functions or API routes for admin operations like the `scheduled_jobs` processor. Never import it in any client component or shared utility that could be bundled to the browser.

### Input Validation & Sanitization

- Validate and sanitize all user inputs on the server before they touch the database. Never trust client-side data.
- Use a validation library (Zod is recommended with Next.js) for all form inputs and API route payloads. Define schemas for every input shape.
- Sanitize all text fields that will be rendered as HTML to prevent XSS. Use a library like `DOMPurify` or ensure all user content is rendered as text, not raw HTML.
- Validate all UUIDs passed as route parameters (e.g. `/weddings/[id]`) on the server before querying the database — malformed IDs should return 404, not a database error.
- Validate webhook payloads (Pixieset, Instagram) using their respective signature verification mechanisms before processing. Reject any request with an invalid signature with a 401.

### Authentication & Authorization

- Every API route and Server Action that accesses the database must verify the user is authenticated first. Never assume a request is authenticated — always call `supabase.auth.getUser()` and check the result before proceeding.
- After confirming authentication, confirm authorization — that the requested resource (wedding, client, etc.) belongs to the authenticated photographer. RLS handles this at the database level, but add an explicit server-side check as a defense-in-depth measure for sensitive operations like deletions.
- The second shooter PIN route (`/checklist/[weddingId]`) is the only public route that accesses wedding data. It must verify the PIN server-side using `bcrypt.compare()` on every request. Never cache or store the verified PIN in localStorage or a cookie without expiry. Use a short-lived signed JWT (1-day expiry) issued server-side after PIN verification.
- Implement rate limiting on auth endpoints and AI generation endpoints to prevent abuse. Use Vercel's built-in rate limiting or a library like `upstash/ratelimit`.

### Database Security

- RLS is enabled on all tables — never disable it. Never use the service role key in client-side code.
- Never construct raw SQL strings with user input. Always use Supabase's query builder (`.eq()`, `.filter()`, etc.) or parameterized queries — these are safe from SQL injection by default.
- Do not expose internal database error messages to the client. Log errors server-side, return generic error messages to the user.

### Secrets in the Browser

- Regularly audit the browser network tab during development. No request from the browser should contain an API key in headers, query params, or request body.
- Never call the Anthropic API, Google Maps server-side APIs, or Instagram API directly from client components. All third-party API calls go through your own Next.js API routes or Server Actions which run on the server.
- The Google Maps JavaScript API key (used for the in-browser map widget) is the one exception — it must be `NEXT_PUBLIC_` and will be visible in the browser. Mitigate this by restricting the key in Google Cloud Console to only the Maps JavaScript API and to your specific domains (localhost + your Vercel domain). Set HTTP referrer restrictions so the key is useless on any other domain.

### General Hygiene

- Keep all dependencies up to date. Run `npm audit` regularly and fix high/critical vulnerabilities before shipping.
- Set secure HTTP headers in `next.config.js`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a `Content-Security-Policy` that restricts script sources.
- Use HTTPS everywhere. Vercel enforces this automatically in production. Never send credentials over HTTP.
- Store the Instagram access token encrypted at rest in the database. Use AES-256 encryption with the `ENCRYPTION_KEY` environment variable before writing to `photographers.ig_access_token`, and decrypt server-side when needed.
- Log security-relevant events server-side (failed auth attempts, invalid PIN submissions, webhook signature failures) but never log sensitive data like tokens, passwords, or full request bodies containing personal information.
