# fintech-devin-demo — KYC Review Queue

An internal-tool prototype for compliance/audit analysts at a Series C fintech: review flagged
customer applications and take auditable actions on them.

Built with Next.js 14 (App Router) + TypeScript, Tailwind CSS, Next.js Route Handlers for the API,
and SQLite (`better-sqlite3`) seeded from a bundled CSV. No Docker, no cloud account, no env keys.

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000
```

On first request the app creates `data/kyc.db` and seeds the `cases` table from `data/cases.csv`.
Delete `data/kyc.db` to reset the demo to the seeded state.

```bash
npm test        # Jest + Testing Library
npm run lint
npm run typecheck
npm run build && npm start
npm run generate:seed   # regenerate data/cases.csv
```

## What the app does

- **Queue (`/`)** — table of all cases with case number, full name, masked SSN, reason flagged,
  risk level, age of request (computed from `created_at`), status, assigned analyst, and city.
  Client-side filtering by risk level and status, sorting by risk level, age, and status, plus an
  empty-queue state.
- **Case detail (`/cases/[caseNumber]`)** — full (fake) PII: name, DOB, home address, unmasked SSN,
  last utility bill address, driver's license number, plus applicant notes, city, and the audit log.
- **Action panel** — pick one of five actions (approve, reject, request documents, escalate,
  reassign) and enter a required comment. Submit stays disabled until the comment is non-empty.
  Submitting POSTs to the API, which writes transactionally and revalidates the queue.
- **Sign in (`/sign-in`)** — the app opens on a sign-in screen where you pick who you are:
  Florence (senior analyst), Patrick (analyst), or Daniel (analyst). The choice is stored in the
  `kyc_analyst` cookie; `middleware.ts` redirects anyone without it back to the sign-in screen, and
  the header shows the signed-in analyst with a Sign out button.
- **Acting analyst** — no longer selectable: the action panel shows the case's assigned analyst
  read-only, and only that analyst may act on the case. For anyone else the panel is disabled and
  the Submit button carries a "Not authorized to take this action" tooltip; the API independently
  returns `403` with the same message.

## Data model

`lib/db.ts` owns all SQLite access; nothing else touches `better-sqlite3`.

`cases`
| column | notes |
| --- | --- |
| `case_number` | PK, e.g. `KYC-1000` |
| `full_name`, `date_of_birth`, `home_address`, `ssn`, `last_utility_bill_address`, `drivers_license_number` | applicant PII (fake) |
| `applicant_notes` | free-text context from onboarding |
| `reason_flagged` | `identity mismatch` \| `address mismatch` \| `document issues` \| `sanctions watchlist` \| `duplicate request` |
| `risk_level` | `medium` \| `high` |
| `city` | US city |
| `created_at` | ISO timestamp, drives "age of request" |
| `status` | `pending_review` \| `approved` \| `rejected` \| `docs_requested` \| `escalated` \| `reassigned` |
| `assigned_analyst` | `Florence` \| `Patrick` \| `Daniel` |
| `approvable` | seed-data marker for the 50 cases that should be approved |

`case_actions` (append-only audit log): `id`, `case_number`, `action`
(`approve` \| `reject` \| `request_docs` \| `escalate` \| `reassign`), `comment` (required,
non-empty), `analyst`, `created_at`.

Every action runs in a single transaction that inserts a `case_actions` row **and** updates
`cases.status` (plus `cases.assigned_analyst` for `reassign`). Existing audit rows are never
mutated.

## API

| Method | Route | Body / notes |
| --- | --- | --- |
| `GET` | `/api/cases` | full queue |
| `GET` | `/api/cases/:caseNumber` | case plus its audit log; 404 when unknown |
| `POST` | `/api/session` | `{ analyst }` → sets the `kyc_analyst` cookie; 400 for an unknown analyst |
| `DELETE` | `/api/session` | clears the session cookie |
| `POST` | `/api/cases/:caseNumber/actions` | `{ action, comment, assignTo? }` → 201 with the updated case and the new audit row; 400 on validation errors, 403 when the acting analyst is not the assigned analyst, 404 for unknown cases |

The acting analyst comes from the session cookie (the `analyst` body field is only a fallback for
API clients without one).

## Seed data

`data/cases.csv` holds 165 fully fake cases, produced by `scripts/generate-cases.ts`. The
generator — not the app — enforces the data constraints:

- every `reason_flagged` is one of the five allowed values;
- `assigned_analyst` is Florence, Patrick, or Daniel, and **all high-risk cases go to Florence**
  (medium-risk work is spread across all three);
- every `city` is a real US city;
- exactly 50 cases are marked `approvable=1`, each with an `applicant_notes` explanation that
  justifies approval (recent move vs. old license address, legal name change after marriage with
  documentation, false-positive watchlist match on a common surname, and so on). The remaining
  cases describe genuinely risky or ambiguous situations.

`npm test` re-verifies these invariants against the committed CSV.

## Access control

`lib/auth.ts` holds the whole policy: `canActOnCase` grants a case only to its `assigned_analyst`,
including for the senior analyst. It is enforced twice — the UI disables the action panel, and the
route handler re-checks the session before touching the data layer. `lib/db.ts` is unchanged and
stays purely a data layer. Note the seed data assigns every high-risk case to Florence, so Patrick
and Daniel can only act on medium-risk cases.

This is a prototype identity: a plain cookie with no password. A production version would swap
`lib/session.ts` for SSO-issued sessions without changing `canActOnCase` or its call sites.

## Tests

`npm test` covers the queue columns/age computation/sort/filter/empty state, the detail view's PII
(masked in the queue, unmasked in detail), each of the five actions and the status it produces,
`reassign` updating `assigned_analyst`, comment validation (empty and oversized), unknown cases and
malformed JSON, seed-data integrity, persistence across a simulated server restart, audit-log
append-only behaviour, the sign-in form and session API, and the authorization rules (403 for a
case assigned to someone else or for an unauthenticated caller, disabled panel plus tooltip in the
UI).

## Security note

All PII in this repository is **fake demo data** generated for the prototype. A production version
of this tool would require SSO-backed authentication, role-based access control over case actions,
encryption of PII at rest and in transit, field-level access logging, and data-retention controls.
