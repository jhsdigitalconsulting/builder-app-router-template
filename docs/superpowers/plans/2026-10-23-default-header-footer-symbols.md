# Default Header/Footer Symbols Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page's header and footer comes from a Builder.io symbol. The site context sets the default symbols, any page can override them, and the symbol section editor can load a symbol by name.

**Architecture:** Server components `SiteHeader` and `SiteFooter` resolve the header and footer in this order: the page's symbol, then the site context's default symbol, then the bare component. A `PageShell` wraps every route. Header, Footer and CenterLogoHeader take a navigation `reference` input, so the menu is picked inside the symbol. The seed script creates `default-header` and `default-footer` symbols, points the site context at them and removes the old navigation fields.

**Tech Stack:** Next.js 16 App Router, React 19, Builder.io Gen 2 SDK (`@builder.io/sdk-react`), TypeScript, Turborepo + pnpm, Storybook 9, Node seed script (`scripts/seed-builder.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-23-default-header-footer-symbols-design.md`
**Prior art:** `/Users/johnhschneider/dev/gacoreweb`. That working copy is behind, so read it with `git show origin/main:<path>`, for example `apps/gacoreweb/components/SiteHeader.tsx`, `SiteFooter.tsx`, `PageShell.tsx` and `app/preview-editors/symbol/[name]/page.tsx`.

## Global Constraints

- Always use `pnpm`, never `npm` or `yarn`.
- Symbol names are exactly `default-header` and `default-footer`.
- Site-context fields: remove `headerNavigation1`, `headerNavigation2` and `footerNavigation1`. Add `defaultHeader` and `defaultFooter` as `reference` fields with `model: "symbol"`.
- Page model fields: remove `headerNavigation1`, `headerNavigation2` and `footerNavigation`. Add `header` and `footer` as `reference` fields with `model: "symbol"`.
- Resolution order: `page.data.<x>` symbol → `siteContext.data.default<X>` symbol → bare `<Header/>` / `<Footer/>`. A reference only counts when `model === "symbol"` and `value` is truthy.
- Symbols render through `RenderBuilderContent` with `model="symbol"` and `data={{ siteContext }}`.
- The symbol editor route is `/section-editors/symbol/[name]`. An empty name or `_` renders an empty editor.
- Assume one site per Builder space (1:1).
- Every app-layer change goes in **both** `apps/amicoglobal` and `apps/amicosecurity`, and the two copies must be identical. `sitemap.ts` is the only file that already differs.
- Shared interfaces stay simple: no `Omit`, `NonNullable` or other utility types.
- Any component over 100 lines that needs sub-components goes in a folder, with the primary component and its Props in `index.tsx`.
- Placeholder images use `.png` URLs.
- Every task ends with `pnpm build` and `pnpm lint` green. Tasks that touch `packages/components` also need `pnpm build:storybook` green.
- Commit as `jschneider@radicaldesign.co`. Do not bump versions.
- The template port (`apps/app-0` in `jhsdigitalconsulting/builder-app-router-template`) is **out of scope**.

**No unit test runner exists in this repo (Claude's call: don't add one).** Each task is checked with the build, lint and Storybook commands, plus scripted `curl` checks against the dev server and Playwright screenshots. Wherever a step says "verify", it gives the exact command and the expected output.

## Review Focus

1. **Override pointing at a deleted or unpublished symbol.** `enrich` returns the reference with no `value`. Expected: fall back to the site default, not a blank header. Covered in Task 1, Step 6.
2. **Symbol names with spaces or special characters in the editor URL** (e.g. `/section-editors/symbol/Promo%20Header`), and names that don't exist. Expected: decoded and found; an unknown name renders an empty editor with HTTP 200, not a 404 or a crash. Covered in Task 3, Step 3.
3. **Re-running the seed after editors changed things.** If the site context's `defaultHeader` points at some other symbol, or `default-header` has been restyled, a re-run changes nothing. Covered in Task 5, Step 6.
4. **Existing space whose site context points at a different menu than the seeded ones.** Expected: the created symbol uses the menu the site context pointed at, not the seeded `primary-navigation` / `footer-navigation`, and the old fields are only removed after the symbols are created. Covered in Task 5, Steps 3 and 6.
5. **Site context missing or failing to load** (`getSiteContext` returns `null`, e.g. wrong `NEXT_PUBLIC_SITE_CONTEXT_NAME`). Expected: the bare Header and Footer render on every route and nothing crashes. Covered in Task 1, Step 6.

---

### Task 1: Header/footer resolution and PageShell in amicoglobal

**Files:**
- Modify: `packages/types/cms/index.ts:67-75` (`PageData`), `:170-190` (`SiteContext.data`)
- Create: `apps/app-0/components/SiteHeader.tsx`, `apps/app-0/components/SiteFooter.tsx`, `apps/app-0/components/PageShell.tsx`
- Modify: `apps/app-0/app/[[...page]]/page.tsx`, `apps/app-0/app/blogs/[handle]/page.tsx`, `apps/app-0/app/not-found.tsx`
- Modify: `docs/DESIGN_PATTERNS.md`, `CLAUDE.md` (Builder.io Integration section)

**Interfaces:**
- Produces (types, additive in this task; old fields are removed in Task 4):
  - `PageData.header?: ModelReference` and `PageData.footer?: ModelReference`
  - `SiteContext.data.defaultHeader?: ModelReference` and `SiteContext.data.defaultFooter?: ModelReference`
- Produces (app):
  - `SiteHeader(props: { siteContext?: SiteContext | null; override?: ModelReference | null; locale?: string }): Promise<JSX.Element>`, the default export of `components/SiteHeader.tsx`
  - `SiteFooter(props: same shape): Promise<JSX.Element>`, the default export of `components/SiteFooter.tsx`
  - `PageShell(props: { siteContext?: SiteContext | null; headerOverride?: ModelReference | null; footerOverride?: ModelReference | null; locale?: string; children: React.ReactNode })`, the default export of `components/PageShell.tsx`. It renders `<div className="flex flex-col min-h-screen">`, then `SiteHeader`, then `<main id="main-content" role="main" className="flex-grow">{children}</main>`, then `SiteFooter`.

- [ ] **Step 1: Capture baseline screenshots before any change**

Run `pnpm dev:amicoglobal` on `main`. With Playwright, take full-page screenshots of `/`, the first `/blogs/<handle>` from `fetchEntries` (or the seeded `/blogs/hello-world`) and `/does-not-exist`. Save them to the scratchpad as `baseline-home.png`, `baseline-blog.png` and `baseline-404.png`. Task 6 compares the header region against these.

- [ ] **Step 2: Add the four new optional fields to the types** (keep the old nav fields for now).

- [ ] **Step 3: Implement `SiteHeader` and `SiteFooter`**

Mirror gacoreweb's versions with these differences:
- Import `getSiteContext` from `../lib/builder`.
- Read `override` first, then `site?.data?.defaultHeader` (or `defaultFooter`).
- The fallback is `<Header />` / `<Footer />` from `@repo/components`, with no props.

Keep the resolution-order comment block.

- [ ] **Step 4: Implement `PageShell` and switch the three routes to it**
  - **`[[...page]]`:** pass `headerOverride={page?.data?.header}` and `footerOverride={page?.data?.footer}`. Move `PageSchema`, `FAQSchemaData` and `RenderBuilderContent` inside the shell as children. Remove the `Header`, `Footer` and `Navigation` imports and the reads of `headerNavigation1` and `footerNavigation`.
  - **`blogs/[handle]`:** replace the wrapper div, `DefaultHeader`, `<main>` and `DefaultFooter` with `<PageShell siteContext={site} locale={locale}>`.
  - **`not-found.tsx`:** replace the fragment, `DefaultHeader` and `Footer` with `<PageShell>`. Its `siteContext` comes from the cached fetch. Keep its existing `<main>` classes on an inner `<div>`.

- [ ] **Step 5: Verify build and lint**

Run: `pnpm build:amicoglobal && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Verify the fallback paths in the dev server**

Run `pnpm dev:amicoglobal`, then `curl -s localhost:3000/ | grep -c '<header'` and `curl -s localhost:3000/does-not-exist | grep -c '<header'`. Expected: `1` each. No symbols exist yet, so this is the bare-Header fallback.

Next, restart with `NEXT_PUBLIC_SITE_CONTEXT_NAME=missing-site pnpm dev:amicoglobal` and repeat the curls. Expected: `1` each, with no server error in the log (Review Focus 5).

For the deleted-symbol case (Review Focus 1), temporarily pass `override={{ "@type": "@builder.io/core:Reference", id: "x", model: "symbol" } as ModelReference}` from the page route. Confirm it still renders a header, then revert.

- [ ] **Step 7: Document the pattern**

In `docs/DESIGN_PATTERNS.md`, add a "Header & footer symbols" subsection under the Builder.io section. Cover the resolution order, the four fields, `PageShell` and the editor route. In `CLAUDE.md`, add a matching bullet block under "Builder.io Integration".

- [ ] **Step 8: Commit**

```bash
git add packages/types apps/amicoglobal docs/DESIGN_PATTERNS.md CLAUDE.md
git commit -m "Resolve header and footer from symbols through a shared PageShell"
```

### Task 2: Mirror the shell into amicosecurity

**Files:**
- Create: `apps/amicosecurity/components/SiteHeader.tsx`, `SiteFooter.tsx`, `PageShell.tsx`
- Modify: `apps/amicosecurity/app/[[...page]]/page.tsx`, `app/blogs/[handle]/page.tsx`, `app/not-found.tsx`

**Interfaces:**
- Consumes: the Task 1 files, copied verbatim.

- [ ] **Step 1: Copy the three components and apply the same route edits.**
- [ ] **Step 2: Verify the apps are identical**

Run: `diff -rq apps/app-0/app apps/amicosecurity/app; diff -rq apps/app-0/components apps/amicosecurity/components`
Expected: the only output is `Files .../sitemap.ts ... differ`.

- [ ] **Step 3: Verify the build**

Run: `pnpm build:amicosecurity && pnpm lint`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/amicosecurity
git commit -m "Use the symbol header/footer shell in amicosecurity"
```

### Task 3: Symbol editor by name and revalidation on symbol publish (both apps)

**Files:**
- Create: `apps/{amicoglobal,amicosecurity}/app/section-editors/symbol/[name]/page.tsx`
- Modify: `apps/{amicoglobal,amicosecurity}/app/api/revalidate/route.ts`
- Modify: `scripts/seed-builder.mjs:278-281` (only the comment above `SYMBOL_PREVIEW_URL_LOGIC`; the logic string is unchanged)

**Interfaces:**
- Consumes: `getSiteContext`, `BUILDER_API_KEY` (`lib/builder.ts`) and `RenderBuilderContent`.
- Produces: route `GET /section-editors/symbol/[name]`. Publishing a `symbol` makes the webhook call `revalidatePath("/", "layout")`.

- [ ] **Step 1: Implement `SymbolEditorPage({ params }: { params: Promise<{ name: string }> })`**

1. Decode `name` with `decodeURIComponent`.
2. If the decoded name is empty or `_`, the symbol is `null`. Otherwise fetch it with `fetchOneEntry({ model: "symbol", apiKey, query: { name }, enrich: true, includeUnpublished: true, locale: "Default", fetchOptions: { cache: "no-store" } })`. Fetch it in parallel with `getSiteContext("en")`.
3. Render `<RenderBuilderContent content={symbol} model="symbol" locale="Default" data={{ siteContext }} />`.
4. Export `dynamic = "force-dynamic"`, since the editor must always see live content.

`includeUnpublished` is a top-level option, not one nested under `options`. gacoreweb learned this the hard way.

- [ ] **Step 2: Handle symbol publishes in the revalidate route**

In `POST`, before `resolvePath`: if `body.modelName === "symbol"`, call `revalidatePath("/", "layout")` and return `{ revalidated: true, path: "/ (layout)" }`.

- [ ] **Step 3: Verify the editor route and the revalidate route in the dev server**

1. Run `curl -s -o /dev/null -w '%{http_code}' localhost:3000/section-editors/symbol/_`. Expected: `200`.
2. Run the same curl against `/section-editors/symbol/No%20Such%20Symbol`. Expected: `200`, with no error in the server log (Review Focus 2).
3. Create a throwaway symbol named `Plan Test Header` in the amicoglobal space through the Builder UI. Open `localhost:3000/section-editors/symbol/Plan%20Test%20Header`. Expected: its content renders. Delete the symbol afterwards.
4. Run `curl -s -X POST localhost:3000/api/revalidate -H "x-revalidate-secret: $REVALIDATE_SECRET" -H 'content-type: application/json' -d '{"modelName":"symbol","newValue":{"data":{}}}'`. Use the header name the route actually reads. Expected: `"revalidated":true`.

- [ ] **Step 4: Copy both files to amicosecurity and re-run the Task 2 Step 2 diff.**

- [ ] **Step 5: Verify the build**

Run: `pnpm build && pnpm lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/*/app/section-editors apps/*/app/api/revalidate scripts/seed-builder.mjs
git commit -m "Load symbols by name in the section editor and revalidate on symbol publish"
```

### Task 4: Navigation reference inputs and removal of the old nav fields

**Files:**
- Modify: `packages/components/components/navigation/Header/index.tsx`, `Header/Header.builder.registration.tsx`
- Modify: `packages/components/components/navigation/Footer/index.tsx`, `Footer/Footer.builder.registration.tsx`
- Modify: `packages/components/components/navigation/CenterLogoHeader/index.tsx` and its registration
- Modify: `packages/components/components/navigation/DefaultHeader/index.tsx`, `DefaultFooter/index.tsx`
- Modify: the stories in each of those folders (`*.stories.ts*`)
- Modify: `packages/types/cms/index.ts` (remove the old fields)

**Interfaces:**
- Produces:
  - `HeaderProps.navigation?: ModelReference`
  - `FooterProps.navigation?: ModelReference`
  - `CenterLogoHeaderProps.navigation1?: ModelReference` and `navigation2?: ModelReference`
  - Each component reads the menu as `navigation?.value as Navigation | undefined` and falls back to its existing built-in default menu.
  - Registration inputs are `{ name: "navigation", type: "reference", model: "navigation", friendlyName, helperText }`. CenterLogoHeader's are `navigation1` and `navigation2`.
  - `DefaultHeader` renders `<Header />` and `DefaultFooter` renders `<Footer />`. Neither uses `useSiteContext` any more. Both keep their named and default exports.
- Removes: `PageData.headerNavigation1`, `headerNavigation2` and `footerNavigation`, and `SiteContext.data.headerNavigation1`, `headerNavigation2` and `footerNavigation1`.

- [ ] **Step 1: Convert the props and registrations**

The helper text is "Pick the Navigation entry shown here. Leave empty to use the built-in default menu." Leave the Header `logo` input as it is.

- [ ] **Step 2: Reduce DefaultHeader and DefaultFooter to bare fallbacks.**

- [ ] **Step 3: Update the stories**

Wrap each mock `Navigation` in `{ "@type": "@builder.io/core:Reference", id: "mock", model: "navigation", value: mockNav }`.

- [ ] **Step 4: Remove the old type fields and fix any references**

Run: `grep -rn "headerNavigation\|footerNavigation" apps packages --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: no output.

- [ ] **Step 5: Verify**

Run: `pnpm build && pnpm lint && pnpm build:storybook`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages
git commit -m "Pick header and footer menus with a navigation reference input"
```

### Task 5: Seed the default symbols and migrate the models

**Files:**
- Modify: `scripts/seed-builder.mjs`

**Interfaces:**
- Consumes: the existing helpers `field`, `referenceValue`, `getEntry`, `ensureModelHasFields(modelName, fields, models)`, `removeModelField(modelName, fieldName, models)`, `writeApi` and `writeUpdateApi`.
- Produces:
  - Constants `HEADER_SYMBOL_NAME = "default-header"` and `FOOTER_SYMBOL_NAME = "default-footer"`
  - `SITE_CONTEXT_SYMBOL_FIELDS` (the `defaultHeader` and `defaultFooter` reference fields, `model: SYMBOL_MODEL_NAME`, with helper text)
  - `PAGE_SYMBOL_FIELDS` (`header` and `footer`, the same shape, with helper text saying they override the site default for this page)
  - `async function ensureSymbol(name, componentName, navId): Promise<string>`, which returns the symbol id
  - `async function ensureSiteContext(headerSymbolId, footerSymbolId)`, which replaces the nav-wiring version
  - `async function removeLegacyNavFields(models)`

- [ ] **Step 1: Replace the model fields**

1. Swap `SITE_CONTEXT_NAV_FIELDS` for `SITE_CONTEXT_SYMBOL_FIELDS` in `MODEL_BODY` and in the `!createdSiteContext` retrofit.
2. Add `ensureModelHasFields(PAGE_MODEL_NAME, PAGE_SYMBOL_FIELDS, models)` next to the existing page `metaField` call.

- [ ] **Step 2: Implement `ensureSymbol`**

If `getEntry(SYMBOL_MODEL_NAME, name)` exists, return its id unchanged. Otherwise POST to `writeApi("symbol")` with:
- `name`
- `published: "published"`
- `data.blocks`: one `@builder.io/sdk:Element` whose `component` is `{ name: componentName, options: { navigation: referenceValue(NAV_MODEL_NAME, navId) } }`

Do not set `logo` or `theme`, so the components keep today's defaults (header parity). If `navId` is null, leave `options` empty. Before writing the JSON, create one symbol by hand in the Builder UI and read it back from `cdn.builder.io/api/v3/content/symbol`. Match that block shape, including `@version` and `id` if Builder sets them.

- [ ] **Step 3: Rework the content flow in `main()`**

1. Before seeding menus, read the existing site-context entry. Let `headerNavId` be `existing.data.headerNavigation1?.id ?? <seeded primary-navigation id>`, and the same for the footer with `footerNavigation1` (Review Focus 4).
2. Call `ensureSymbol(HEADER_SYMBOL_NAME, "Header", headerNavId)` and `ensureSymbol(FOOTER_SYMBOL_NAME, "Footer", footerNavId)`, then `ensureSiteContext(headerSymbolId, footerSymbolId)`.
3. `ensureSiteContext` sets `defaultHeader` and `defaultFooter` to `referenceValue(SYMBOL_MODEL_NAME, id)` only where they're unset. It strips the three legacy keys from the merged `data` before PATCHing.
4. Call `removeLegacyNavFields(models)` last. It removes the three site-context fields and the three page fields.

The removal must come **after** the menu ids are read.

- [ ] **Step 4: Update the file header comment** (steps list, fields) **and the `--models-from` note**, if copied models skip the baseline retrofits.

- [ ] **Step 5: Run the seed against a fresh throwaway space**

Ask the user for a scratch Builder space's keys. Do not use the live amico spaces in this task. Run `pnpm --filter amicoglobal init:builder` with that space's `.env.local` values.

Expected:
- the symbols `default-header` and `default-footer` exist
- the site context has `defaultHeader` and `defaultFooter` set
- the page model has `header` and `footer` fields
- no legacy nav fields remain

Check with `pnpm --filter amicoglobal exec node -e` or the builder-admin-api skill's CLI.

- [ ] **Step 6: Re-run the seed and check idempotency**

Before re-running, change the site context's `defaultHeader` to a different symbol in the UI, and edit `default-header`'s block. Then run the seed a second time.

Expected:
- the log shows "already exists" / "skipping" for both symbols and the site context
- both manual edits are still there (Review Focus 3)

Then repeat Step 5 against a space whose site context had `headerNavigation1` pointing at a non-seeded menu. Expected: `default-header` references that menu (Review Focus 4).

- [ ] **Step 7: Verify**

Run: `pnpm build && pnpm lint`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed-builder.mjs
git commit -m "Seed default-header and default-footer symbols and drop the old nav fields"
```

### Task 6: Roll out to the amico spaces and verify end to end

**Files:** none (content and verification only)

- [ ] **Step 1: Get explicit user approval to run the seed against the live amicoglobal and amicosecurity Builder spaces.** It removes fields and edits the site context.

- [ ] **Step 2: Run the seed against both spaces**

Run `pnpm --filter amicoglobal init:builder`, then `pnpm --filter amicosecurity init:builder`. Expected: both symbols are created and the site context is wired in each space.

- [ ] **Step 3: Compare against the baseline**

With `pnpm dev:amicoglobal` running, screenshot `/`, the same blog article and `/does-not-exist`, and compare them with the Task 1 baselines.

Expected:
- the header region matches the baseline
- the footer shows the seeded `footer-navigation` menu (Home, About, Blog, Contact) on all three pages

- [ ] **Step 4: Check the page-level override**

In Builder, create a symbol `landing-header` and set it as the home page's `header`, then publish. Expected:
- `/` shows `landing-header`
- the blog page still shows `default-header`

Clear the override. Expected: `/` shows `default-header` again.

- [ ] **Step 5: Check the editor and webhook**

Open `default-header` in the Builder editor. Expected: the preview loads `/section-editors/symbol/default-header` and shows the header. Edit the symbol and publish it. Expected: the webhook revalidates and the live page updates without waiting 5 minutes.

- [ ] **Step 6: Repeat Steps 3–5 on amicosecurity (port 3001).**

- [ ] **Step 7: Run the final checks**

Run: `pnpm build && pnpm lint && pnpm build:storybook`
Expected: all exit 0. Report the results with the screenshots.
