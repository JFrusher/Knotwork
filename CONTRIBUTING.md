# Contributing to Trousseau

Thank you for thinking about it. Trousseau is used by real couples planning
real weddings, so a fix here can save someone a bad evening with a
spreadsheet. Bug reports, fixes, documentation and whole new tools are all
welcome.

**The one rule that matters most:** never paste a real guest list, real names,
emails or dietary requirements into an issue, a pull request, a test fixture
or a screenshot. Use the guided tour's example wedding, or invent people.

---

## Ways to help

| You have… | Do this |
| --- | --- |
| Ten minutes | Try the [hosted app](https://trousseau-suite.vercel.app), and open an issue for anything confusing. Confusion is a bug. |
| An hour | Pick an issue labelled `good first issue`, or fix a doc that was wrong for you. |
| A weekend | Take a tool proposal from [ROADMAP.md](ROADMAP.md). |
| A job nothing does | Build a tool. Read [docs/BUILDING-A-TOOL.md](docs/BUILDING-A-TOOL.md) first. |

---

## Reporting a bug

Open an issue with:

1. **What you did.** The steps, starting from which page.
2. **What happened.** Include the exact error text if there was one.
3. **What you expected.**
4. **Where.** The hosted site or your own copy, and your browser.
5. **A screenshot**, with names blurred, if it is visual.

"Not sure how to reproduce it; it happened while I was moving tables" is still
a useful report. Leave the rest blank if you don't know it.

**Security problems** (one account reading another's wedding, a guest link
revealing more than one seat, anything touching row-level security): do not
open a public issue. Use GitHub's **Report a vulnerability** button on the
Security tab, so it can be fixed before it is public.

## Suggesting a feature

Open an issue that starts from the job, not the solution: "I needed to know
who was bringing the cake stand" beats "add a cake stand field". Then:

- Check [ROADMAP.md](ROADMAP.md). It may already be planned, or explicitly
  ruled out with a reason.
- Check `docs/superpowers/specs/`. Design decisions are written down there
  rather than living in anyone's head.
- If it could be a whole tool, [docs/BUILDING-A-TOOL.md](docs/BUILDING-A-TOOL.md)
  has five questions to answer first. Most ideas turn out to be a feature of
  an existing tool, and that is a good outcome.

Some things are ruled out on purpose and will be closed with a pointer to the
reason. These include RSVP collection (Joy and similar do it well, and
Trousseau imports the result), a paid tier of any kind, and an admin panel
that can browse weddings.

---

## Local setup

### Prerequisites

- **Node.js 20 or newer.** CI runs Node 22, so that is the safest choice.
- **npm 10 or newer.**
- Nothing else for local development: no database, no account, no Docker.

### Install and run

```sh
git clone https://github.com/JFrusher/Trousseau.git
cd Trousseau

npm ci                 # installs the root package and the suite workspace
npm run build          # builds the contract package into dist/
npm run dev -w suite   # http://localhost:3000
```

**Do not skip `npm run build`.** The suite depends on the contract package via
`"@jfrusher/trousseau": "file:.."`, which resolves to the root `dist/`. A
fresh clone has no `dist/`, and the install succeeds anyway. The failure
turns up later as:

```
Module not found: Can't resolve '@jfrusher/trousseau'
```

If you see that, run `npm run build` at the root and try again.

To work on accounts, sync or guest links you need a Supabase project. See
[docs/SELF-HOSTING.md](docs/SELF-HOSTING.md). For sync work alone,
`SYNC_IN_MEMORY=1` in `suite/.env.local` runs the sync endpoints against an
in-process map (development only).

### Where things live

```text
src/                     the data contract: zod schemas and the file format (MIT)
suite/                   the Next.js application (AGPL-3.0-or-later)
  apps/                  Seating (tableaux), Place cards (plaque),
                         Timeline (cadence), Delegation (brigade)
  lib/                   the shared document, sync, accounts, and newer tools
  components/            the shell, and the newer tools' panels
  app/                   routes and API
  e2e/                   Playwright specs, run against a production build
supabase/migrations/     database migrations, applied in filename order
docs/                    self-hosting, building a tool, specs and plans
scripts/                 bundle, sync and cross-slice validation utilities
```

The first four tools keep their original code names (Tableaux, Plaque,
Cadence, Brigade) as folder names. The product calls them Seating, Place
cards, Timeline and Delegation.

---

## The rules every change keeps

These are why the tools never disagree. A PR that breaks one will be asked to
change, however good the rest is.

1. **A tool writes only its own slice** of the wedding document, and copies
   every other key untouched, including keys it does not recognise.
2. **One editor per fact.** A guest's name is corrected in one place, and
   everything else reads it.
3. **Fail loudly.** A missing configuration refuses to start, and a save that
   failed says so. Nothing silently falls back.
4. **No guest data to advertising, analytics or error-reporting services.** Account sync may send it only to the configured storage backend described in the Privacy Policy.
5. **Privacy text matches the code.** If you change what the app collects or
   sends, change the Privacy Policy in the same PR.

---

## Checks to run before a pull request

These are exactly what CI runs (`.github/workflows/ci.yml`). Build the contract
package first; everything else needs it.

| Check | Command |
| --- | --- |
| Build the contract package | `npm run build` |
| Typecheck the contract | `npm run typecheck` |
| Typecheck the suite | `npm run typecheck -w suite` |
| Test the contract | `npm test` |
| Test the suite | `npm run test -w suite` |
| Build the suite | `npm run build -w suite` |
| End-to-end, with axe | `npm run e2e -w suite` (after the suite build; needs Playwright's Chromium) |
| Dependency audit | `npm audit --audit-level=high` |

If `tsc` in the suite reports `Cannot find name 'LayoutProps'`, it is not a
real error. Next generates that type into `.next/types` during a build. Run
`npm run build -w suite` once and check again.

---

## Pull requests

1. **One change per PR.** A bug fix, or a feature, not both.
2. **Branch names** say what kind of work it is: `fix/…`, `feat/…`, `docs/…`,
   `refactor/…`.
3. **Commit messages** say what changed for the person using it, in plain
   English: "Clocks nobody set stay unset, everywhere", not "fix: null check".
4. **Test the behaviour, not the implementation.** A bug fix comes with a test
   that failed before the fix. New UI gets a Playwright spec if it can be
   reached from the keyboard.
5. **Accessibility is checked.** The e2e run includes axe on every page, so a
   new page or dialog must pass it.
6. **Open against `main`** and describe what a user would notice. Screenshots
   help, with made-up names.
7. **CI must be green.** If a failure looks unrelated, say so in the PR rather
   than re-running until it passes.

### Changing the database

Add a new, timestamped file to `supabase/migrations/`. Never edit one that
has already been applied. Every table gets row-level security, and a change to
a `security definer` function needs a test. Read the
[database review](docs/superpowers/specs/2026-09-29-database-review.md) first.
Supabase's Security Advisor suggests "fixes" that would lock every couple out
of their own wedding.

### Changing the contract package

`src/` is published to npm as `@jfrusher/trousseau` and other tools may
depend on it. Changes must be additive: a new optional field, never a renamed
or removed one. `npm run verify` checks that the published build still
imports cleanly.

---

## Code of conduct

Be kind, be patient, and assume good faith. Many people here are planning
their own wedding and are already stressed. Harassment or personal attacks
of any kind will get you removed from the project.

## Licence

By contributing, you agree that your contribution is licensed under the
licence of the part you changed: **AGPL-3.0-or-later** for `suite/`, and
**MIT** for the contract package at the root. See [LICENSE](LICENSE).
