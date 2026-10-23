# Builder.io App Router Template

A [Turborepo](https://turbo.build/repo) monorepo template pairing **Next.js 16 (App Router)** with the **Builder.io Gen 2 SDK** (`@builder.io/sdk-react`) for visual editing. It ships a shared component library, a shared design-token theme, and a Storybook workspace.

This is the App Router port of the Pages Router `builder-app-template`. It is functionally equivalent, rebuilt on React Server Components, the Gen 2 Builder SDK, and Next.js 16's `proxy.ts` (the replacement for `middleware.ts`).

## Tech Stack

- **Turborepo** + **pnpm workspaces** (`pnpm@9.15.4`)
- **Next.js 16** App Router with **React 19**
- **Builder.io Gen 2 SDK** (`@builder.io/sdk-react`)
- **TypeScript**, **Tailwind CSS**, **Storybook 9** (`@storybook/nextjs-vite`)

## Getting Started

Install dependencies (use **pnpm**):

```bash
pnpm install
```

The repo pins Node **22.23.4** (`.nvmrc`, `engines: "22.x"`). `.npmrc` sets `use-node-version`, so pnpm downloads that Node on first use and runs every script with it, even if your shell is on another version.

### Guided setup (recommended)

Run the interactive setup from the repo root:

```bash
pnpm configure
```

> Use `pnpm configure`, not `pnpm setup` — `pnpm setup` is a reserved pnpm built-in that configures the shell environment.

It will:

1. Prompt for your Builder.io **public** and **private** API keys and write them into the app's `.env.local`.
2. Optionally **rename** the placeholder `app-0` app (updates every reference across the monorepo and moves the directory — re-run `pnpm install` afterward).
3. Provision the Builder space by running `init:builder` (see below).

### Adding another site

Once the repo is configured (the placeholder app has been renamed), re-running `pnpm configure` asks **"Create another site?"**:

- **Yes** first asks how to set the new site up: a **fresh site** (the template's baseline Builder models) or a **copy of an existing site** (its app code plus its current Builder models, cloned into a new space). It then copies a site app to `apps/<name>` (without `node_modules`, build output or `.env.local`), gives it the next free dev port, writes its `.env.local`, adds `dev:<name>` / `build:<name>` root scripts, records its Vercel project in `.claude/project-config.md`, runs `pnpm install`, and optionally seeds its Builder space. Each site normally gets its **own Builder space**, because the `page` model (including the home page at `/`) is shared by everything in a space. You can skip the API keys, add them to `apps/<name>/.env.local` later, and then run `pnpm --filter <name> init:builder`.
- **No** lets you pick an existing site and re-run the setup steps above for it.

Both paths ask every question first, then show a summary. Nothing is written until you confirm it, and Ctrl+C at any prompt cancels the script without changing anything.

`init:builder` always seeds the app it runs in (the `--filter` target), using that app's `.env.local` and dev port.

When another site app has its own Builder space, the seed step asks where this space's models come from:

- **Baseline models from the template** — the models described below.
- **Copy the models from `<site>`'s space** — clones that site's model definitions as they are in Builder right now, including changes made by hand in the Builder UI (added or removed fields, preview URLs, model settings, UI-only models). `model`-type field references are remapped to the new space's model ids and webhooks are left out. Content isn't copied; the sample content is still seeded for the models that exist. Run it directly with `pnpm --filter <name> init:builder --models-from=<site>`.

### Provision Builder.io models

`pnpm configure` does this for you; run it directly when you only need to (re)seed models.

The app reads models that don't exist in a brand-new Builder space:

- **`site-context`** — global site data (name, logo, organization/contact details, social links) read by every page in the root layout.
- **`article`** — the blog content model behind `/blogs/[handle]` and the sitemap.
- **`url-redirect`** — a list of redirect rules applied at build time (see [URL redirects](#url-redirects)).

Without them the app throws `"Error fetching data."` at runtime and `pnpm build` fails with `"Model not found"`. A one-time seed script creates the models and populates a default `site-context` entry, a sample article, plus a sample redirect:

```bash
# Requires BUILDER_PRIVATE_KEY in apps/app-0/.env.local (bpk-...)
pnpm --filter app-0 init:builder
```

The script ([`apps/app-0/scripts/seed-builder.mjs`](./apps/app-0/scripts/seed-builder.mjs)) is **idempotent** — re-running it skips anything that already exists, so it's safe to run on every fresh clone. Edit the seeded defaults afterward in the Builder.io editor.

> The model schemas are created through the Builder **Admin GraphQL API** (`addModel`); the default content is written through the **Write REST API** (the Admin GraphQL API has no content-write mutation).

### Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app. Builder.io content is fetched and rendered through the App Router catch-all route in `apps/app-0/app/[[...page]]/`.

## URL redirects

Redirect rules are managed in the Builder.io **`url-redirect`** model — no code change or redeploy-by-hand required to add a rule, just edit content in Builder. Each entry holds a `redirects` list, and every rule has three fields:

| Field | Description |
| --- | --- |
| `urlFrom` | Source path to match. Supports Next.js path syntax, e.g. `/old/:slug*`. |
| `urlTo` | Destination path or URL, e.g. `/new-page`. |
| `permanentRedirect` | On → **308** (permanent). Off → **307** (temporary). Defaults to permanent. |

[`apps/app-0/lib/redirects.ts`](./apps/app-0/lib/redirects.ts) reads every entry and feeds the rules into Next.js's [`redirects()`](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects) in [`next.config.ts`](./apps/app-0/next.config.ts).

This runs at **build time** — redirect changes in Builder take effect on the next deploy. That keeps redirects fast (handled by Next/the CDN with no per-request fetch) and is the right trade-off for most sites. The fetch fails open: a missing model or network error logs a warning and ships zero redirects rather than breaking the build. If a project outgrows Next's ~1,024-redirect limit or needs per-domain rules, graduate to a `proxy.ts`/middleware approach that reads a generated JSON file at request time.

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm configure` | Guided first-run setup: API keys, optional app rename, Builder provisioning. On a configured repo, it offers to add another site |
| `pnpm dev` | Start the development server (port 3000) |
| `pnpm --filter app-0 init:builder` | Provision the `site-context`, `article`, and `url-redirect` models in a fresh Builder space |
| `pnpm build` | Build all apps except Storybook |
| `pnpm build-all` | Build everything, including Storybook |
| `pnpm lint` | Lint the workspace |
| `pnpm storybook` | Start Storybook at http://localhost:6006 |
| `pnpm build-storybook` | Build the static Storybook site |

## Project Structure

```
apps/
  app-0/        Next.js 16 App Router application
  storybook/    Storybook component workspace
packages/
  components/   Shared component library (@repo/components)
  types/        Shared TypeScript types (@repo/types)
```

See [`CLAUDE.md`](./CLAUDE.md) for detailed architecture and component-development guidance.

## Claude Code commands

This template ships a suite of Claude Code slash commands under
`.claude/commands/` (PR creation, PR feedback, Jira grooming and dev pipeline,
solution review, build fixes, and component scaffolding). They read per-project
values — Jira project key, cloud ID, base URL, and Vercel project name — from
`.claude/project-config.md`, which `pnpm configure` populates. If you skip Jira
during setup, the Jira-aware commands simply omit their Jira steps.

Notably, **`/new-component`** scaffolds a new component following the
self-contained-folder pattern in
[`packages/components/COMPONENT_PATTERN.md`](./packages/components/COMPONENT_PATTERN.md),
and asks whether it should be registered with Builder.io.

## Deploy on Vercel

The easiest way to deploy is the [Vercel Platform](https://vercel.com/new). Set the project's root to the monorepo root and provide the Builder.io environment variables from `env.example`.
