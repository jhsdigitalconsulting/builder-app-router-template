# Design: Symbol-based default header/footer with page overrides, and symbol editor by name

**Date:** 2026-10-23
**Status:** Approved
**Prior art:** GA-CORE/gacoreweb, `docs/superpowers/specs/2026-06-24-default-header-footer-symbols-design.md`
(and its `SiteHeader`, `SiteFooter`, `PageShell`, `app/preview-editors/symbol/[name]/page.tsx`)

## Intent

gacoreweb lets a site set a **default header and footer** once, in site settings, and lets any
single page (typically a landing page) **override** either one. That feature was never ported
back into the template this repo was built from
(`jhsdigitalconsulting/builder-app-router-template`, now the `upstream` remote). This change
brings it into amico-web and then merges it up into the template, so every future site gets it.

Alongside it, the symbol section editor gains a **name parameter** so a specific symbol entry
can be loaded and previewed by name.

## Goals

1. Header and footer are Builder.io **symbols**. The site context names the default symbols; a
   page can name its own symbols to override them.
2. A freshly seeded site comes up with default header and footer symbols already in place, and
   its home page **header renders visually the same as it does today**. The footer becomes the
   same on every page (see "Footer consistency" below).
3. The symbol editor route loads a symbol by name: `/section-editors/symbol/[name]`.
4. Every route that shows a header/footer (catch-all page, blog article, 404) resolves them the
   same way.
5. Lands in both `apps/amicoglobal` and `apps/amicosecurity`.

**Template port is out of scope for this plan.** Once this is finished and tested in amico-web,
it is ported to `jhsdigitalconsulting/builder-app-router-template` (`apps/app-0`, generic names)
as a separate piece of work.

## Non-goals

- Changing the visual design of Header, Footer, or CenterLogoHeader.
- New preview editors for other models (gacoreweb has some for data models; not needed here).
- Renaming `section-editors` to gacoreweb's `preview-editors`.
- Moving to Next.js Cache Components / `"use cache"` (gacoreweb uses it; amico uses ISR `revalidate`).

## Anti-goals (would be a failure even if it "works")

- The seeded home page header looks different after the change.
- A page with no override, or a site with no default symbol set, renders no header/footer.
- Re-running the seed on an existing space duplicates symbols or overwrites symbols/site-context
  values an editor has already changed.

## Decisions (agreed with stakeholder)

1. **Navigation lives inside the symbol.** Each header/footer symbol contains a single Header or
   Footer component; that component's `navigation` input references a `navigation` entry.
   Navigation menus stay in the `navigation` model.
2. **Site context:** remove `headerNavigation1`, `headerNavigation2`, `footerNavigation1`; add
   `defaultHeader` and `defaultFooter` (`reference` fields, `model: "symbol"`).
3. **Page model:** remove `headerNavigation1`, `headerNavigation2`, `footerNavigation`; add
   `header` and `footer` (`reference`, `model: "symbol"`) as per-page overrides.
4. **Seed creates the default symbols.** The seed builds a header symbol and a footer symbol from
   today's Header/Footer components wired to the seeded menus, and points the site context's
   `defaultHeader`/`defaultFooter` at them. Idempotent on spaces that already have them.
5. **Section editor:** add `/section-editors/symbol/[name]`, which fetches the symbol by name
   (matching the preview URL the seed already sets on the symbol model).
6. **Order:** build and test in amico-web first (both apps); port to the template afterwards as
   separate work.
7. **One footer everywhere.** All pages show the same default footer, in amico-web and later
   the template.

## Footer consistency

Today the footer differs by route: the catch-all page route reads `page.data.footerNavigation`
(never set), so Builder pages show the Footer component's built-in links (Terms of Service,
Privacy Policy, Contact Us), while blog articles use `DefaultFooter` → `siteContext.footerNavigation1`
→ the seeded `footer-navigation` menu (Home, About, Blog, Contact). Both live amico spaces are in
this state.

The seeded default footer symbol references the seeded `footer-navigation` menu, so after the
change every page shows that menu and editors control it from Builder. Builder pages' footer
links therefore change from the built-in set to the seeded menu; this is accepted.
(Choosing the seeded menu over the built-in links is Claude's call, under the stakeholder's
"all pages show the same footer" decision.)

## Resolution model

```
header: page.data.header (symbol) → siteContext.data.defaultHeader (symbol) → bare <Header/>
footer: page.data.footer (symbol) → siteContext.data.defaultFooter (symbol) → bare <Footer/>
```

- A reference only counts if `model === "symbol"` and it has a resolved `value` (both fetches use
  `enrich: true`, which resolves the reference — and the navigation reference inside it).
- The resolved symbol renders through `RenderBuilderContent` with `model="symbol"` and
  `data={{ siteContext }}` so component bindings (`state.siteContext.*`) resolve inside it.
- The bare fallbacks get no `navigation` prop and use their built-in default menus.

## Changes by area

### Types — `packages/types/cms/index.ts`
- `SiteContext.data`: drop `headerNavigation1/2`, `footerNavigation1`; add
  `defaultHeader?: ModelReference`, `defaultFooter?: ModelReference`.
- `PageData`: drop `headerNavigation1/2`, `footerNavigation`; add `header?: ModelReference`,
  `footer?: ModelReference`.

### Components — `packages/components/components/navigation/`
- **Header** and **Footer**: the `navigation` prop becomes a `ModelReference` (resolved via
  `.value`), matching how a `reference` input arrives from Builder. Registration input changes
  from `type: "object"` to `type: "reference", model: "navigation"` with helper text, as in
  gacoreweb. Built-in default menus stay as the fallback.
- **CenterLogoHeader** (`navigation1`, `navigation2`): same conversion to `reference` inputs, so it
  can also be used inside a header symbol.
- **DefaultHeader / DefaultFooter**: reduced to bare `<Header />` / `<Footer />` fallbacks (no more
  site-context nav lookup), keeping named + default exports and stories.
- Stories updated for the prop change.

### App layer — in **both** `apps/amicoglobal` and `apps/amicosecurity`
- New `components/SiteHeader.tsx`, `components/SiteFooter.tsx` (server components implementing
  the resolution model; fetch site context themselves when not passed — the fetch is cached).
- New `components/PageShell.tsx` wrapping header / `<main id="main-content">` / footer.
- `app/[[...page]]/page.tsx`: render through `PageShell` with `page.data.header` /
  `page.data.footer` as overrides; stop reading the old nav fields.
- `app/blogs/[handle]/page.tsx` and `app/not-found.tsx`: use `PageShell` (no overrides).
- New `app/section-editors/symbol/[name]/page.tsx`: decode `name`; if it is `_` or empty render an
  empty `<Content model="symbol">`; otherwise `fetchOneEntry({ model: "symbol", query: { name },
  enrich: true, includeUnpublished: true })` and render it with `data={{ siteContext }}`. The
  existing `/section-editors/symbol` page stays.
- `app/api/revalidate/route.ts`: a `symbol` publish revalidates the whole site layout
  (`revalidatePath("/", "layout")`) since a header/footer symbol appears on every page.

### Seed — `scripts/seed-builder.mjs`
- Replace `SITE_CONTEXT_NAV_FIELDS` with `defaultHeader` / `defaultFooter` symbol reference fields.
- Add `header` / `footer` symbol reference fields to the page model.
- `removeModelField` the old nav fields from site-context and page (existing spaces).
- New `ensureDefaultSymbols(headerNavId, footerNavId)`: create (if missing, matched by name) a
  header symbol containing one `Header` block whose `navigation` is a reference to the seeded
  primary menu, and a footer symbol containing one `Footer` block referencing the seeded footer
  menu. Then set the site context's `defaultHeader` / `defaultFooter` only where unset.
- Rework `ensureSiteContext` to stop writing nav references.
- **Assumption (stakeholder):** every site has its own Builder space (1:1). The symbol seeding
  does not need to handle two sites sharing a space; the existing shared-space guard for the
  home page / Site URL (commit 209d0a3) is left as is.
- Update the header comment block that documents what the seed provisions.

### Docs
- `docs/DESIGN_PATTERNS.md` and `CLAUDE.md`: describe the header/footer resolution and the symbol
  section editor.

## Builder's calls (left to the implementer)

- **Symbol naming (stakeholder decision):** generic names `default-header` and `default-footer`,
  in the template and in these sites. Safe because of the one-site-per-space assumption below.
- **Shared shell:** `PageShell` + `SiteHeader` + `SiteFooter`, used on every route. (Claude's call.)
- **Revalidation on symbol publish** as described above. (Claude's call.)
- Keep `section-editors` folder naming. (Claude's call.)
- Exact Builder block JSON for the seeded symbols — model it on a symbol created by hand in the
  editor and read back via the Content API.

## Rollout for existing amico spaces

Running `pnpm --filter <app> init:builder` against each existing amico space adds the new fields,
creates the default symbols wired to the existing `primary-navigation` / `footer-navigation`
entries, sets the site-context defaults, and removes the old fields. Content editors then
restyle the symbols in Builder as needed.

## Verification

- `pnpm build`, `pnpm lint`, `pnpm build:storybook` all green.
- Fresh space: seed, then the home page header looks the same as before the change
  (screenshot comparison), and the footer shows the seeded `footer-navigation` menu on the home
  page, a blog article and the 404 page alike.
- Page with a `header`/`footer` override renders the override; clearing it falls back to the site
  default; clearing the site default falls back to the bare component.
- `/blogs/<handle>` and a 404 render the site default header/footer.
- Opening a symbol in Builder loads `/section-editors/symbol/<name>` with that symbol's content.
- Re-running the seed is a no-op the second time.
