# isUD Website

Next.js application for managing Universal Design projects, checklists, teams, and certification progress.

## Getting Started

Install dependencies:

```powershell
npm install
```

Create a local env file:

```powershell
cp .env.example .env
```

Update `.env` with your Neon `DATABASE_URL`/`DIRECT_URL`, then apply database migrations and seed the reference data:

```powershell
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

Start the development server:

```powershell
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Useful Scripts

- `npm run dev` starts Next.js on port 3001 and clears stale `.next` output first.
- `npm run build` creates a production build. It refuses to run while the dev server is active to avoid missing CSS assets.
- `npm run smoke` checks that the local page and generated CSS load correctly.
- `npm run lint` runs ESLint.

## Project Structure

- `src/app/(dashboard)` contains authenticated project pages.
- `src/app/(marketing)` contains public/legal/register pages.
- `src/app/api` contains Next.js route handlers.
- `src/components` contains shared UI and feature components.
- `src/lib` contains auth, Prisma, and scoring helpers.
- `prisma` contains the schema, migrations, and seed script.
- `data/legacy` and the root `UD_S_*.csv` files are seed inputs and should stay committed.

## Notes

Keep secrets in `.env`; it's ignored by git.
For Vercel production, set the variables from `.env.production.example` in the Vercel dashboard:

- `DATABASE_URL`: Neon Postgres pooled connection string (`*-pooler.neon.tech`, with `sslmode=require&pgbouncer=true&connection_limit=1`).
- `DIRECT_URL`: Neon Postgres direct (non-pooled) connection string, used for running migrations.
- `NEXTAUTH_URL`: the deployment's actual domain (custom domain if one is attached, otherwise the `*.vercel.app` URL Vercel assigns the project).
- `NEXTAUTH_SECRET`: a stable random secret. Generate one with `openssl rand -base64 32`.
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL`: used by `src/lib/mailer.ts` to send verification, invite, and password-reset email via Brevo.
