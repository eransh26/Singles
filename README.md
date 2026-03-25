# Discreet Community MVP

This repository now contains the completed Milestones 1-4 MVP:
- member auth and profile foundation
- feed, posts, comments, groups, and join requests
- photo access, chat requests, conversations, messages, and notifications
- separate admin shell for moderation, verification review, events, audit logs, member accounts, and admin accounts
- Prisma schema, migrations, seed data, and Playwright E2E coverage

## First-Time Setup

1. Copy `.env.example` to `.env` and fill the real values.
2. Install dependencies:
   - `npm install`
3. Generate the Prisma client:
   - `npm run prisma:generate`
4. Apply migrations to the main local database:
   - `npm run prisma:deploy`
5. Apply the custom integrity SQL against the same main database:
   - run `prisma/sql/post_migrate_constraints.sql`
6. Seed the main local database:
   - `npm run prisma:seed`
7. Optional but recommended for E2E isolation: create and migrate a separate E2E database matching `E2E_DATABASE_URL`.
   - `npx prisma migrate deploy` with `DATABASE_URL` temporarily set to `E2E_DATABASE_URL`
8. Start the app locally:
   - `npm run dev`

## Production Build

- Build:
  - `npm run build`
- Start:
  - `npm run start`

## E2E Test Run

- Install Playwright browsers once:
  - `npm run test:e2e:install`
- Run the full suite:
  - `npm run test:e2e`

The Playwright setup seeds deterministic test data automatically and is designed to use `E2E_DATABASE_URL` so your manual local data in `DATABASE_URL` stays separate.

## Important Environment Notes

- `AUTH_SECRET` must be a real strong secret in every non-test environment.
- `AUTH_URL` must match the actual base URL being used.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` must match the Google OAuth client you configured.
- `E2E_BASE_URL` defaults to `http://localhost:3000`.
- Optional tunnel/dev origins should be provided through env instead of editing `next.config.js`:
  - `NEXT_PUBLIC_DEV_TUNNEL_ORIGIN`
  - `DEV_ALLOWED_ORIGINS` as a comma-separated list

## Important Integrity Rules

- One active pending join request per `(groupId, applicantUserId)` is enforced via `GroupJoinRequest.pendingKey` plus DB constraints.
- One active pending chat request per pair is enforced via `ChatRequest.pendingKey` and canonical `pairKey`.
- One active pending photo-access request per requester/owner pair is enforced via `PhotoAccessRequest.pendingKey` and directional `pairKey`.
- `Report` must have exactly one target field populated matching `targetType`.
- Public profiles are still app-authenticated views, not open-web indexable content.
