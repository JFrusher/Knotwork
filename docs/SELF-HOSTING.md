# Running your own Knotwork

Knotwork is free software and this is a genuinely supported way to use it, not
a theoretical one. Every command below was run on a fresh clone before it was
written down.

You need this only if you want accounts, sync between devices, or the guest
seat links. **If you just want to plan a wedding on one machine, you do not
need any of this** — clone it, install, `npm run dev`, and the whole suite
works with no account and no backend, exactly as it does hosted.

## What you are running

Two pieces, licensed differently (see [`LICENSE`](../LICENSE)):

- The **application** in `suite/` — a Next.js app. AGPL-3.0-or-later. If you
  host a modified version for other people, they are entitled to your source.
- The **contract package** at the repo root, published as
  `@jfrusher/knotwork`. MIT. It is the schemas and the file format.

## Requirements

- Node 20 or newer (`"engines": { "node": ">=20" }`).
- A Supabase project, if you want accounts, sync or guest links. The free tier
  is enough for a wedding.
- Nothing else. There is no Docker image, on purpose — the setup is small
  enough that a container would be a second thing to maintain rather than a
  simplification.

## 1. Clone and build

**The order matters, and getting it wrong is the most common way to fail:**

```sh
git clone <your fork, or this repo> Knotwork
cd Knotwork

npm install          # the contract package's dependencies
npm run build        # builds dist/ — do not skip this

cd suite
npm install
```

### Why `npm run build` comes first

`suite/package.json` depends on `"@jfrusher/knotwork": "file:.."`, which
resolves to the root's `dist/` directory. A fresh clone has no `dist/`, and
`npm install` does not create one — only `npm run build` does.

Skip it and `suite`'s install still succeeds, which is the trap. The failure
arrives later, and does not mention any of the above:

```
Error: Turbopack build failed with 4 errors:
Error: Module not found: Can't resolve '@jfrusher/knotwork'
```

If you see that, you are in the right place: run `npm run build` in the repo
root and try again.

## 2. Run it locally, with no backend at all

```sh
cd suite
npm run dev
```

Open <http://localhost:3000>. Everything works: seating, the timeline, place
cards, delegation, group shots. There is no account, nothing leaves the
browser, and the wedding lives in IndexedDB.

Stop here if that is all you want.

## 3. Add a backend

```sh
cd suite
cp .env.example .env.local
```

`.env.local` is gitignored. The variables:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | sync, accounts | Your project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | sync, accounts | Server-side only. Never expose it to the browser. |
| `NEXT_PUBLIC_SUPABASE_URL` | accounts | The same value as `SUPABASE_URL`. Duplicated because the browser bundle can only read `NEXT_PUBLIC_`-prefixed variables. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | accounts | The anon/publishable key. Safe in the browser — row-level security is what protects the data. |
| `CRON_SECRET` | the retention sweep | At least 16 characters. Unset means the sweep endpoint refuses everything, including your scheduler. |
| `NEXT_PUBLIC_SENTRY_DSN` | error reporting | Optional. Unset means no Sentry, browser or server. |
| `LOG_LEVEL` | server logs | Optional. `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. Unset means `info` in production and `debug` elsewhere. |

Two things that will catch you out:

- **`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both-or-neither.** Half
  the pair fails the build rather than starting a half-working instance.
- **Accounts need all three of `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.** With fewer, sign-in reports "accounts are
  not set up on this deployment" — the correct answer for a deliberately
  local-only instance, and thoroughly confusing if you meant to enable them.

`VERCEL_PROJECT_PRODUCTION_URL` also appears in the schema. Vercel supplies it
automatically and it is used to build absolute URLs for canonical links, Open
Graph tags, the sitemap and `robots.txt`. On another host you may need an
equivalent — see `siteUrl()` in `suite/lib/env.ts`.

### Sign-in: email code, Google and Apple

Sign-in is a six-digit email code, or Google or Apple. None of it needs an
environment variable in this app — the provider credentials live in Supabase.
All of it is configured in the Supabase dashboard:

1. **Authentication → URL Configuration.** Set **Site URL** to your production
   origin, and add every origin you sign in from to **Redirect URLs** with a
   wildcard, because the callback carries `?next=`:
   `https://your-host/**` and `http://localhost:3000/**`.
2. **Authentication → Email Templates → Magic Link.** The email must show the
   code: include `{{ .Token }}` in the template.
3. **Google** — in Google Cloud Console, create an OAuth client ID (type *Web
   application*). Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the **Client ID**
   and **Client Secret** into Supabase → Authentication → Providers → Google
   and enable it.
4. **Apple** — in the Apple Developer portal:
   - an **App ID** with *Sign in with Apple* enabled;
   - a **Services ID** (this is the client ID Supabase asks for), with *Sign in
     with Apple* configured: domain `<project-ref>.supabase.co`, return URL
     `https://<project-ref>.supabase.co/auth/v1/callback`;
   - a **Key** with *Sign in with Apple* enabled — download the `.p8` and note
     its **Key ID** and your **Team ID**.

   Generate the client secret (a JWT signed with the `.p8`; Supabase's Apple
   provider page links a generator) and paste the Services ID and secret into
   Supabase → Authentication → Providers → Apple. **The secret expires after six
   months at most** — put renewing it in a calendar, or Apple sign-in stops.

The sign-in page asks Supabase which providers are switched on and shows a
button only for those, so a provider you have not set up simply does not
appear — enable it and its button does.

## 4. Apply the migrations

Every file in `supabase/migrations/`, in filename order, skipping none. Later
ones depend on earlier ones, and the earliest build a schema a later one
removes, so a file left out breaks the ones after it. They are not listed here
because a list here goes out of date the day a migration is added.

Either paste each into Supabase's SQL editor in that order, or use the Supabase
CLI (`supabase db push`) with the project linked.

Together they create the account and membership tables with their row-level
security policies, the per-wedding document store and its history, the guest
and supplier links, the planners' library, and the live channel. **The RLS
policies are what make one couple unable to read another's wedding**, so
applying them is not optional.

Supabase's Security Advisor will then warn that signed-in people can execute
sixteen `security definer` functions, and anyone three. That is the design:

- every write goes through one of the sixteen, and each checks who is calling;
- the three are the guest-link and supplier-link readers and the supplier's
  Confirm, for whoever holds a link.

**Do not apply the advisor's remedies to them** — revoking `EXECUTE`, or
switching to `SECURITY INVOKER`. Done to `is_wedding_member`, either one stops
every signed-in person reading their own wedding. The hosted project met
exactly that; see D8 in the
[database review](design/specs/2026-09-29-database-review.md).

## 5. Build and start

```sh
cd suite
npm run build     # runs the root build first, then next build
npm start
```

`suite`'s `build` script is `npm --prefix .. run build && next build`, so it
handles the contract package for you — unlike `dev`, which is why section 1
tells you to build the root by hand.

## 6. Check it actually works

A clean build is not proof. Confirm the instance behaves:

```sh
cd suite
npx vitest run          # every project — 1,588 tests at the time of writing
npx tsc --noEmit        # no errors
```

If `tsc` reports `Cannot find name 'LayoutProps'`, that is not a real error.
`LayoutProps` is generated by Next into `.next/types`, which is gitignored and
does not exist until something has been built. Run `npx next build` once and
re-run the check.

Then, in the browser:

1. Open the app. The five tools load and you can add a guest.
   *(Local storage works.)*
2. Go to `/login` and sign in with an emailed code, then with Google and Apple
   if you enabled them.
   *(Accounts, email and providers work.)*
3. Add a guest, then reload. It is still there.
   *(Cloud sync works.)*
4. From `/account`, choose **Download my wedding**. You get a
   `.knotwork.json` file.
   *(The document store and the export path work.)*

If step 2 says accounts are not set up, go back to section 3 — it is almost
always `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing.

### Health, versions and logs

`GET /api/health` answers 200 when everything the instance is configured to
use responds, and 503 when the database does not. Point an uptime monitor at
it. It also names the build:

```sh
curl -s https://your-host/api/health
# {"status":"ok","version":"0.1.0","commit":"ce429f1","builtAt":"…","environment":"production",
#  "checks":{"database":"ok","accounts":"configured","errorReporting":"configured"}}
```

Every response carries `X-App-Version`, `X-Commit-SHA` and `X-Request-ID`. In
a browser console, `window.appVersion` says the same. The server logs one JSON
object per line, and every line written while handling a request carries
that request's `requestId`. To find what the server did for a request, search
the logs for the `X-Request-ID` it returned. A caller's own `X-Request-ID` or
`X-Correlation-ID` is kept when it is a plain token of up to 128 characters.

## 7. Deploy it somewhere

The hosted instance runs on Vercel with **Root Directory** set to `suite`, and
that is the least surprising option. Any host that can run a Next.js app will
do; set the same environment variables there.

On Vercel, and only there, the app counts page visits with Vercel Web
Analytics, which is switched on in the project's settings. Every address is
cut to its page before it is sent (`lib/pageCounts.ts`), and the Privacy
Policy describes exactly that — change one and you must change the other.

## Keeping up with changes

Migrations are additive and applied in filename order. When you pull, apply any
migration files you have not already run, then rebuild.

## If you get stuck

There is no support desk and no admin panel: nobody running the hosted
instance browses a couple's wedding, and support never asks to look at one.
Open an issue with what you did and what happened.

**Do not paste your guest list into an issue.**
