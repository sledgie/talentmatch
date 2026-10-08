# Hirepilot Dashboard

A Vite + React + Tailwind app that walks a candidate through:
1. Pasting a job description
2. Uploading their resume + email address
3. Submitting both to an analysis webhook (e.g. n8n), which emails back the
   match results a few minutes later

Supabase handles authentication (login/signup) in front of this flow, and
`supabase/schema.sql` defines the tables to persist jobs, requirements, and
analysis results once you're ready to store them instead of only emailing them.

## 1. Set up Supabase

1. Create a project at supabase.com (free tier is fine).
2. In the dashboard, go to **Connect** (or Project Settings > API) and copy
   your **Project URL** and **anon public** key.
3. In the Supabase **SQL Editor**, paste and run `supabase/schema.sql`. This
   creates `profiles`, `jobs`, `job_requirements`, `analysis_requests`,
   `comparisons`, and `comparison_results`, all with row-level security, a
   trigger that auto-creates a `profiles` row on signup, and a private
   `resumes` Storage bucket (with its own RLS policies) for saved resumes.
   If the `insert into storage.buckets` line errors in your project (some
   plans restrict writing to that table directly), just create the bucket by
   hand instead: **Storage > New bucket**, name it `resumes`, and leave
   "Public bucket" unchecked — the rest of the SQL (the RLS policies) will
   still apply to it.
4. Email/password sign-up is on by default under
   **Authentication > Providers** — no extra config needed.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in (or confirm) these values in `.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANALYSIS_API_URL=...
VITE_ANALYSIS_API_USERNAME=...
VITE_ANALYSIS_API_PASSWORD=...
```

`.env` is gitignored — never commit it.

### A note on the analysis webhook credentials

Vite inlines every `VITE_*` variable into the JS bundle it ships to the
browser. That means `VITE_ANALYSIS_API_USERNAME` / `VITE_ANALYSIS_API_PASSWORD`
are visible to anyone who opens dev tools on the deployed site — `btoa()`
only base64-encodes them, it doesn't hide them. That's an acceptable
trade-off for a local prototype hitting a throwaway webhook, but before
putting real credentials behind this and shipping it, move the webhook call
behind your own backend or a Supabase Edge Function so the credentials never
reach the browser.

## 3. Run it locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). You'll land on the
login/signup screen first; after signing up you may need to confirm your
email before logging in (toggle this under
Authentication > Providers > Email if you want to skip it while testing).

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

- `src/supabaseClient.js` — creates the Supabase client from your `.env` vars
- `src/Auth.jsx` — login/signup form wired to `supabase.auth` (always uses
  the default brand color — there's no signed-in user yet to have a theme)
- `src/theme.js` — the 14 color-combination themes (id, name, two colors,
  and their original color-name labels), a default (`teal-porcelain`), and
  a `getTheme(id)` lookup
- `src/App.jsx` — checks the session, shows `Auth` or `Dashboard`, and loads
  the signed-in user's `theme_id` from `profiles` once on login, holding it
  as the single source of truth passed down as a resolved `theme` object
  (plus an `onThemeChange` setter) to `Dashboard`
- `src/resumeStorage.js` — shared helpers (`fetchSavedResumeMeta`,
  `uploadResumeAndSaveToProfile`, `downloadResumeBlob`) used by both
  `Dashboard.jsx` and `ProfilePage.jsx` so "what's saved" and "what gets
  submitted" never drift out of sync
- `src/Dashboard.jsx` — the sidebar + the 3-step flow. Applies the active
  theme throughout: the first color becomes the sidebar background and
  every primary button; the second becomes a soft highlight tint behind
  active/selected states (always paired with the first color as the text/
  icon on top of it, since several of the second colors are pale). Status
  colors (green for success, red for errors, amber for partial matches) are
  untouched by theming — only brand/accent elements change. The resume step
  now checks for a saved resume on load: if one exists it's offered as the
  primary, pre-selected option, with "Use a different resume instead" to
  switch to uploading; if none exists, uploading is the only option. Either
  way, whichever resume is actually selected (`resumeSource` state: `"saved"`
  or `"upload"`) is what gets attached to the n8n submission — a saved
  resume is re-downloaded from Storage as a Blob at submit time, a freshly
  uploaded file is sent as-is. Choosing a new file also offers to save (or,
  if one was already saved, overwrite) it on the profile — but only on
  explicit confirmation; nothing is written to Storage silently anymore —
  unless Settings' "Resume handling" preference is set to always/never
  auto-save, in which case this step skips the prompt accordingly. The
  resume step also seeds the "prefer the resume's own email" toggle from
  Settings instead of always starting unchecked.
- `src/ProfilePage.jsx` — edit first/last name and email, change password,
  and view/replace the stored resume; now built on the same
  `resumeStorage.js` helpers as the dashboard, and themed the same way
- `src/SettingsPage.jsx` — the Theme picker (with a live mini-dashboard
  preview), notification toggles (match-ready email, tips email —
  currently just stored, not yet sent by anything), the resume-save
  preference (ask/always/never) that the resume step reads, and the
  "prefer resume email by default" toggle. Picking a theme here calls
  `onThemeChange` immediately, so the whole app (sidebar included) updates
  live before you even click "Save settings" — the click is what persists
  it to `profiles.theme_id`; navigating away without saving reverts it next
  time you log in, same as every other setting on this page.
- `supabase/schema.sql` — all tables + RLS policies + the private `resumes`
  Storage bucket + the auto-profile trigger
- `src/resumeBuilder.template.html` — the Resume Builder itself: a large,
  mostly self-contained HTML/CSS/JS mock (22 templates, a live preview,
  a portfolio/LinkedIn field in the contact header, a professional summary,
  optional toggle-on sections for Certificates &amp; Trainings and
  Additional Accomplishments, honors/coursework per education entry,
  simulated AI skill suggestions) imported as a raw string (`?raw`) and
  rendered inside a sandboxed `<iframe>` in `ResumeBuilder.jsx`, rather than
  ported into React — its CSS leans on global `:root` variables and bare
  element selectors (`body`, `button`, `input`) that would otherwise clash
  with the rest of the app, so full isolation was the simpler, safer call.
  Three small modifications turn its "mock" buttons into real behavior:
  "Save draft" and "Back" now `postMessage` to the parent instead of just
  toasting, and "Use this resume" renders the live preview to a PDF (via
  `html2canvas` + `jsPDF`, loaded from cdnjs inside the iframe) and posts
  the resulting bytes up as well.
- `src/ResumeBuilder.jsx` — loads any saved draft from
  `profiles.resume_builder_draft`, injects it (plus the active theme's two
  colors, so the builder's accent matches whatever's picked in Settings)
  into the template before mounting the iframe, and listens for its three
  messages: `back` → returns to the dashboard, `save-draft` → upserts the
  draft JSON to Supabase, `use-resume` → turns the returned bytes into a
  real `File` and hands it to `App.jsx`.

## Notes / next steps

- The analysis step currently only logs the webhook's immediate response —
  wire the n8n workflow to write into `analysis_requests` / `comparisons` /
  `comparison_results` (via the Supabase REST API or a Supabase client inside
  n8n) so the Results screen can read real data instead of showing a static
  confirmation message.
- Resumes uploaded from either the main flow or My Profile land in the same
  private `resumes` bucket and the same `profiles` columns, so replacing a
  resume in one place is reflected in the other.
- Clicking "Don't have a resume yet?" on the resume step takes over the
  whole screen with the Resume Builder (no sidebar, matching its own
  layout) via a top-level `screen` state in `App.jsx` — it's a sibling of
  `Dashboard`, not nested inside it. Finishing ("Use this resume") hands
  the generated PDF back to the resume step as if it had been uploaded:
  it's auto-selected, and the usual ask/always/never save behavior from
  Settings still applies to it.
- The PDF is built by screenshotting the live preview (`html2canvas`) and
  embedding that image into a PDF (`jsPDF`) — it won't produce selectable
  text, just a faithful image of what's on screen, paginated if the resume
  runs long. Good enough for a first version; a text-based PDF (actual
  selectable text, smaller file size) would mean writing real PDF content
  per template instead of rasterizing, which is a bigger follow-up.
- Both libraries load from cdnjs.cloudflare.com inside the iframe. If this
  app is ever deployed behind a Content-Security-Policy that restricts
  script sources, that domain needs to be allowed (or the libraries
  switched to a self-hosted copy) or PDF export will silently fail.
- The notification toggles in Settings (`notify_match_ready`, `notify_tips`)
  are stored but not yet acted on by anything — there's no code here that
  checks them before sending an email. That logic belongs in the n8n
  workflow (or wherever match-result emails actually get sent): have it read
  these two columns via the Supabase REST API before deciding whether to
  email a given user.
- Changing email in My Profile calls `supabase.auth.updateUser({ email })`,
  which by default sends a confirmation link to the new address before the
  change takes effect — the UI shows a note about this, but doesn't yet poll
  for confirmation or reflect a pending-change state.
- The sidebar's **Job Analysis**, **Compare**, and **Settings** items are
  still inert placeholders — only **Dashboard** and **My Profile** switch
  views right now.
