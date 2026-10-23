# Design Patterns & Standards

> **Audience:** AI coding agents and human contributors working in this repo.
> **Status:** Authoritative. When this document and a stale comment disagree, this document wins — but **always verify against the actual file** before acting (paths and APIs evolve).
> **Companion docs:** [`CLAUDE.md`](../CLAUDE.md) (project + global rules), [`packages/components/COMPONENT_PATTERN.md`](../packages/components/COMPONENT_PATTERN.md) (component checklist), [`docs/vercel-miu-audit.md`](./vercel-miu-audit.md) (MIU optimization source of truth).

This guide makes the conventions in this codebase **explicit and prescriptive**. Each section states the pattern, shows the real implementation, and lists hard rules. Treat the rules as non-negotiable unless the user instructs otherwise.

---

## 0. Ground rules (read first)

These apply to **every** change, no matter how small.

1. **Package manager is pnpm** (`pnpm@9.15.4`). Never run `npm` or `yarn`. Workspace commands: `pnpm --filter app-0 <cmd>`.
2. **After any code change, build and lint must pass.** Run `pnpm build` and `pnpm lint` (and `pnpm build:storybook` if you touched components/stories). Fix every error before declaring done.
3. **Do NOT bump app/package versions in PRs.** The release branch is gone; `develop` merges directly into `main`.
4. **Default images use placehold.co with an explicit `.png` extension** (e.g. `https://placehold.co/600x400.png`). Never omit the extension.
5. **Never use `Math.random()` (or other nondeterministic values) in render output** — it causes React hydration mismatches. If you need a stable id, derive it deterministically or use `useId`.
6. **Keep interfaces simple.** Define props with plain fields. Do **not** use `Omit`, `Pick`, `NonNullable`, mapped types, or other complex TS notation in component prop interfaces. (The one sanctioned exception is the centralized cast in `registry/shared.ts` — see §6.)
7. **Components over ~100 lines** with subcomponents/helpers must be split into a folder: primary component + `Props` in `index.tsx`, helpers in sibling files.
8. **This is a Turborepo + pnpm workspace monorepo.** Shared packages (`@repo/components`, `@repo/types`) are consumed via `transpilePackages` — there is **no separate build step** for them.

---

## 1. Architecture at a glance

```
builder-app-router-template/
├─ apps/
│  ├─ app-0/            # Next.js 16 App Router app (the deployed site)
│  └─ storybook/        # Storybook 9 (@storybook/nextjs-vite)
├─ packages/
│  ├─ components/       # @repo/components — shared component library + Builder registry
│  └─ types/            # @repo/types — shared TS types + design-kit input bundles
├─ turbo.json           # task pipeline
└─ pnpm-workspace.yaml
```

- **Next.js 16 App Router**, **React 19**, React Server Components by default.
- **Builder.io Gen 2 SDK** (`@builder.io/sdk-react`): server-side `fetchOneEntry` / `fetchEntries`, rendered with `<Content>`.
- **Tailwind CSS** driven by a shared token source (`packages/components/tailwind-theme.json`).
- **TypeScript everywhere.**

### App Router layout (`apps/app-0/app/`)
| Path | Purpose |
|------|---------|
| `layout.tsx` | Root layout |
| `[[...page]]/page.tsx` | Catch-all rendering Builder.io `page` content (ISR) |
| `blogs/`, `blogs/[handle]/` | Blog list + article routes |
| `section-editors/` | Builder.io section editing routes |
| `not-found.tsx` | 404 |
| `sitemap.ts` | Dynamic sitemap (daily ISR) |
| `proxy.ts` | **Next.js 16 proxy** (replaces legacy `middleware.ts`) — i18n + error redirects + deployment protection |

> **Next 16 note:** the request-time interceptor is `proxy.ts` exporting a `proxy()` function, **not** `middleware.ts`. Do not reintroduce `middleware.ts`.

---

## 2. Theming

The theme system is **CSS custom properties cascaded by a `data-theme` attribute**, with a React context for components that need to read the active theme.

### 2.1 The three layers

1. **Brand color variables** — defined once on `:root` in `apps/app-0/styles/globals.css`:
   ```css
   :root {
     --primary-dark: #1d0f34;
     --primary-light: #ffffff;
     --secondary-light: #f5f5f5;
     --secondary-dark: #647589;
     --accent-purple: #6610f2;
     --accent-green: #20c997;
     --accent-magenta: #b31d9d;
     --accent-cyan: #5ce1e6;
     --accent-teal: #0dcaf0;
     --accent-light-purple: #8c52ff;
     --primary-cyan: #5ce1e6;
     --primary-accent: #6610f2; /* same as --accent-purple */
   }
   ```
   **These are the real brand values — use them, do not invent hex codes.**

2. **Theme-aware semantic variables** — each theme file maps brand colors to `--theme-*` slots. Example, `apps/app-0/styles/themes/light.css`:
   ```css
   [data-theme="light"],
   [data-theme] [data-theme="light"] {
     --theme-bg: var(--primary-light);
     --theme-text: var(--primary-dark);
     --theme-heading: var(--primary-dark);
     --theme-heading-alt: var(--accent-purple);
     --theme-text-muted: var(--secondary-dark);
     --theme-link: var(--accent-purple);
     --theme-btn-text: var(--primary-light);
   }
   ```
   The double selector (`[data-theme] [data-theme="light"]`) lets themes **nest** — a `light` block inside a `dark` block re-resolves correctly.

3. **Tailwind utility classes** map to those variables. Use `bg-theme-bg`, `text-theme-text`, `text-theme-heading`, etc. — never hardcode colors in components.

### 2.2 The six themes
`light`, `dark`, `accent`, `gradient`, `transparent-light`, `transparent-dark`.
All are imported at the top of `globals.css` (CSS `@import` must precede other rules — Turbopack enforces this). The canonical list lives in `@repo/types`:

```ts
// packages/types/design-kit/themeable.ts
export const standardThemes = [
  "light", "dark", "accent", "gradient", "transparent-light", "transparent-dark",
] as const;
export type Theme = (typeof standardThemes)[number];
```

### 2.3 `Themeable` and theme inheritance
Themeable components extend the `Themeable` interface (kept deliberately simple):
```ts
export interface Themeable {
  theme?: Theme;
  maskOpacity?: number;
  inheritTheme?: boolean;
}
```

`ThemeProvider` resolves the theme, sets `data-theme`, applies base classes, and provides context:
```tsx
// packages/components/components/common/ThemeProvider/index.tsx  ("use client")
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children, theme, inheritTheme = false, className = "",
}) => {
  const resolvedTheme = useResolvedTheme(theme, inheritTheme);
  return (
    <ThemeContextProvider theme={resolvedTheme} parentTheme={theme}>
      <div data-theme={resolvedTheme}
        className={`bg-theme-bg text-theme-text transition-colors duration-200 ${className}`}>
        {children}
      </div>
    </ThemeContextProvider>
  );
};
```

Resolution precedence (`hooks/useTheme.ts`):
1. `inheritTheme === true` and a context theme exists → inherit from parent.
2. Otherwise an explicit `theme` prop → use it.
3. Otherwise a context theme → inherit.
4. Final fallback → `"light"`.

### Theming rules
- **DO** style components with `--theme-*` Tailwind classes (`text-theme-text`, `bg-theme-bg`, `text-theme-heading`).
- **DO** add `theme` (+ optionally `inheritTheme`) to any new section-level component via `themeableInputs` (see §6).
- **DO** add a `[data-theme="..."]` block to **every** theme file when introducing a new `--theme-*` slot — leaving one out breaks that theme silently.
- **DON'T** hardcode hex colors in components or invent new ones. Add a brand variable to `globals.css` first if a genuinely new color is needed.
- **DON'T** read the theme on the server; theme hooks are `"use client"`.

---

## 3. URL redirects (`url-redirect` model)

Redirects are **content, not code**. Editors manage them in the Builder.io `url-redirect` data model; the app reads them **at build time**.

### How it works
- `apps/app-0/lib/redirects.ts` → `getBuilderRedirects()` fetches every `url-redirect` entry via `fetchEntries`, flattens each entry's `redirects` list, dedupes by `urlFrom` (first wins), caps at `limit: 200`, and maps to Next's `{ source, destination, permanent }`.
- `permanentRedirect` → `true` = **308**, `false` = **307**. Default when unset is `true`.
- Wired into `next.config.ts` as `redirects: getBuilderRedirects`.
- **Fails open:** no API key, a missing model, or a network error logs and returns `[]` — never breaks the build.

```ts
// apps/app-0/lib/redirects.ts (essentials)
export async function getBuilderRedirects(): Promise<NextRedirect[]> {
  const apiKey = process.env.NEXT_PUBLIC_BUILDER_API_KEY;
  if (!apiKey) return [];
  try {
    const entries = await fetchEntries({
      model: "url-redirect", apiKey,
      options: { noTargeting: true }, limit: 200,
    });
    const seen = new Set<string>();
    const redirects: NextRedirect[] = [];
    for (const entry of entries ?? []) {
      for (const rule of (entry?.data?.redirects ?? []) as UrlRedirect[]) {
        if (!rule?.urlFrom || !rule?.urlTo || seen.has(rule.urlFrom)) continue;
        seen.add(rule.urlFrom);
        redirects.push({ source: rule.urlFrom, destination: rule.urlTo, permanent: rule.permanentRedirect ?? true });
      }
    }
    return redirects;
  } catch (error) {
    console.error("Failed to load url-redirect entries from Builder.io:", error);
    return [];
  }
}
```

### Redirect rules
- **DO** add/edit redirects in Builder.io, not in code. Changes take effect on the **next deploy**.
- **DO** keep the fail-open behavior — a redirect fetch must never break a production build.
- `urlFrom`/`urlTo` pass through verbatim, so Next path syntax (`/old/:slug*`) works.
- **Graduation path:** if the site outgrows Next's ~1,024-redirect limit or needs per-domain/request-time logic, move to a `proxy.ts` approach reading a generated JSON file. Document the change here if you do.
- The model + a sample rule are provisioned by `scripts/seed-builder.mjs` (`pnpm --filter app-0 init:builder`).

---

## 4. Proxy, i18n & locale handling

`apps/app-0/proxy.ts` is the Next 16 request interceptor. It is intentionally minimal and matcher-scoped to **minimize Edge Middleware Invocations** (see §5).

```ts
export function proxy(request: NextRequest) {
  const errorRedirect = handleErrorRedirect(request);
  if (errorRedirect) return errorRedirect;

  const url = new URL(request.url);
  const hasFileExtension = /\.[^/]*$/.test(url.pathname);
  if (!hasFileExtension) {
    const localeResponse = handleLocaleRedirect(request);
    if (localeResponse) return localeResponse;
  }

  let response = NextResponse.next();
  response = handleDeploymentProtection(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|500|.*\\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|txt|xml|map)$).*)",
  ],
};
```

- Handlers (`handleLocaleRedirect`, `handleErrorRedirect`, `handleDeploymentProtection`) come from `@repo/components/utils/middlewareUtils`.
- Static-asset extensions are excluded from the matcher so they bypass the proxy entirely (zero MIU). **Document extensions (`.html`/`.pdf`) are deliberately NOT excluded** so legacy redirects still flow through.

### i18n model
- **English at the root** (`/about`); **Spanish prefixed** (`/es/about`).
- `apps/app-0/lib/page-utils.ts`:
  ```ts
  export const DEFAULT_LOCALE = "en";
  export const SUPPORTED_LOCALES = ["en", "es"];
  ```
  `resolvePageParams(segments)` detects the locale, strips a leading locale segment, and returns `{ locale, urlPath }` for the Builder fetch.

### Proxy/i18n rules
- **DO** keep the matcher tightly scoped — every path it matches is a billable edge invocation.
- **DO** route new locale logic through `page-utils` + the shared middleware utils, not ad-hoc code in routes.
- **DON'T** reintroduce `middleware.ts`.

---

## 5. Vercel MIU (Managed Infrastructure Usage) optimization

Cost discipline is a first-class concern. The source of truth is [`docs/vercel-miu-audit.md`](./vercel-miu-audit.md). Key levers already in place — **preserve them**:

| Lever | Where | Why |
|-------|-------|-----|
| **ISR on pages** | `app/[[...page]]/page.tsx` → `export const revalidate = 300` | Serves cached HTML; editors still get instant updates via Builder preview. Must be a **literal** — segment config is statically analyzed and rejects env/runtime expressions. |
| **Daily sitemap ISR** | `app/sitemap.ts` → `export const revalidate = 86400` | `fetchEntries` is uncached in Next 16; without this every crawler hit re-runs fetches (Function Invocations + Edge Requests). |
| **Image cache TTL** | `next.config.ts` → `minimumCacheTTL: 2678400` (~31 days) | CMS/commerce image URLs are immutable per URL; caches each optimized variant instead of re-optimizing. Cuts Image Optimization transforms + Fast Data Transfer. |
| **Trimmed device sizes** | `next.config.ts` → `deviceSizes: [640,750,828,1080,1200,1920,2048]` | Drops the 3840px (4K) variant — the largest transform/transfer; 4K displays fall back cleanly to 2048px. |
| **Proxy matcher excludes static assets** | `proxy.ts` | Static files bypass the proxy → zero Edge Middleware Invocations. |
| **`React.cache()` dedup** | `lib/builder.ts` → `getSiteContext` wrapped in `cache()` | Dedupes the per-locale site-context fetch across `layout`, `generateMetadata`, and the page within one render. |

```ts
// lib/builder.ts — request-scoped dedup
export const getSiteContext = cache(
  async (locale: string = "en"): Promise<SiteContext | null> => {
    const siteContext = await fetchOneEntry({
      model: "site-context", apiKey: BUILDER_API_KEY,
      query: { name: SITE_CONTEXT_NAME }, options: { noTargeting: true },
      enrich: true, locale,
    });
    if (!siteContext) console.error("ERROR: No site context found for name:", SITE_CONTEXT_NAME);
    return (siteContext as SiteContext | null) || null;
  }
);
```

### MIU rules
- **DO** keep `revalidate` values as literals; never compute them.
- **DO** wrap any fetch reused across `layout`/`generateMetadata`/page in `React.cache()` to dedup within a render.
- **DO** parallelize independent fetches with `Promise.all` (see `page.tsx` fetching page + site context together).
- **DON'T** add per-request Builder fetches to the proxy or to hot paths.
- **DON'T** widen the proxy matcher or restore the 4K image size without a measured reason — both directly raise MIU.
- When changing any of the above, update `docs/vercel-miu-audit.md`.

---

## 6. Components & registration

The authoritative checklist is [`packages/components/COMPONENT_PATTERN.md`](../packages/components/COMPONENT_PATTERN.md). Summary of the enforced pattern:

### 6.1 Self-contained component folders
Every component — registered or not — lives in its own folder:
```
packages/components/components/{category}/{Name}/
├─ index.tsx                          # component + `Props` interface (named + default export)
├─ {Name}.builder.registration.tsx   # ONLY if registered with Builder.io
└─ {Name}.stories.tsx                # co-located Storybook story
```
Categories: `ui/`, `layout/`, `cta/`, `navigation/`, `seo/`, `common/`.

### 6.2 The registry barrel chain
```
{Name}.builder.registration.tsx   exports `registration: RegisteredComponent[]`
        │  (imports inputs + withImage from registry/shared.ts)
        ▼
registry/{category}.ts             thin barrel — concatenates each component's `registration`
        ▼
registry/index.ts                  combines barrels into `customComponents`
        ▼
apps/app-0/registry/index.ts       APP owns the final shipped list
apps/app-0/registry/register.ts    APP registers insert menus + design tokens (client-only)
```

**`registry/shared.ts` is the single cast site.** The shared input bundles in `@repo/types` are declared `as const` (readonly tuples) which the SDK's mutable `Input[]` rejects. `shared.ts` widens them in exactly one place:
```ts
export type Inputs = NonNullable<RegisteredComponent["inputs"]>;
export const themeableInputs = themeableInputsRaw as unknown as Inputs;
// ...commonInputs, heroicInputs, ctaInputs, etc.
export const withImage = (): { image: string } | Record<string, never> => {
  const envImage = process.env.NEXT_DEFAULT_COMPONENT_IMAGE;
  return envImage ? { image: envImage } : {};
};
```
> This is the **only** place `as unknown as` casting of inputs is allowed. Always import `themeableInputs`, `commonInputs`, `withImage()`, etc. from `registry/shared.ts` — never re-cast in a component file.

### 6.3 Example registration
```tsx
// components/ui/Button/Button.builder.registration.tsx
import type { RegisteredComponent } from "@builder.io/sdk-react";
import { themeableInputs, withImage, type Inputs } from "../../../registry/shared";
import Button from "./index";

const buttonInputs: Inputs = [
  ...themeableInputs,
  { name: "label", type: "string", required: true, defaultValue: "Learn More", helperText: "The text content of the button" },
  { name: "href", type: "CMSLink", defaultValue: { type: "url", href: "#" }, helperText: "Where the button links to: a page or entry in Builder, or an external URL" },
];

export const registration: RegisteredComponent[] = [
  { component: Button, name: "Core:Button", hideFromInsertMenu: true, override: false, ...withImage(), inputs: buttonInputs },
  { component: Button, name: "Button", override: true, ...withImage(), inputs: buttonInputs },
];
```
> The dual `Core:Button` (hidden override) + `Button` (visible) pattern keeps Builder's built-in mapped to this component while still exposing it in the insert menu. Don't collapse such pairs.

### 6.4 Link fields: always use `CMSLink`
Every link field on a CMS model or registered component uses the **`CMSLink`** input type. This applies to component inputs, list `subFields`, shared bundles (`buttonInputs`, `ctaInputs`), and data-model fields (such as `navigation`'s `href` at every level). Never model a link as `string`, `text`, or `url`.

- **Editor:** the `@jhsdc/builder-input-types` plugin (source in `plugins/builder-input-types`, also listed in the Builder.io marketplace as CMS Link) registers the `CMSLink` editor. It must be installed in the Builder space. The seed script reminds you if it isn't.
- **Value shape:** `CMSLinkProps` from `@repo/types`:
  ```ts
  { type: "url" | "model"; href: string; model?: string; referenceId?: string; openInNewTab?: boolean }
  ```
  `type: "url"` is a literal URL. `type: "model"` references a Builder entry. It resolves at request time through `apps/app-0/app/dynamiclink/[model]/[type]/[id]/route.ts`, which looks up the entry's `url` (or builds `/blogs/{handle}` for articles), so the link follows the entry when its slug changes.
- **Props:** type link props as `LinkValue` (`CMSLinkProps | string`). The string case keeps content that was saved before the conversion working.
- **Rendering:** never read `link.href` directly. Use `resolveLinkHref(link, fallback)`, `shouldOpenInNewTab(link)`, `hasLinkHref(link)` and `isExternalHref(href)` from `packages/components/utils/links.ts`, or render through `DynamicLink`.
- **Defaults and seed data:** `defaultValue: { type: "url", href: "#" }`. Seeded entries use `urlLink("/path")` in `scripts/seed-builder.mjs`.
- **Exceptions:** fields that can only ever hold an external URL or a pattern, not a link an editor picks: `socialNetworks[].href`, `url-redirect` `urlFrom`/`urlTo`, and schema.org data URLs.

```tsx
// Registration
{ name: "buttonHref", type: "CMSLink", defaultValue: { type: "url", href: "#" },
  helperText: "Where the button links to: a page or entry in Builder, or an external URL" },

// Component
interface TileProps { buttonHref?: LinkValue }
<a href={resolveLinkHref(buttonHref)}>...</a>
```

### 6.5 Insert menus & app ownership
- Component **names** are grouped into menus in `packages/components/registration/insert-menus.ts` (Navigation, UI, Layout, CTA, SEO) — but the **app** owns what actually ships and registers:
  - `apps/app-0/registry/index.ts` — final `customComponents` list (start from package defaults; filter/append/override here).
  - `apps/app-0/registry/register.ts` — client-only `registerEditor()` calling `register("insertMenu", ...)` and `registerDesignTokens(...)`. **Must run only in the browser** (`register` touches browser globals).

### 6.6 New-component checklist
1. Create `components/{category}/{Name}/index.tsx` with `Props` interface + named & default export.
2. If registered: add `{Name}.builder.registration.tsx` exporting `registration`, importing inputs + `withImage()` from `registry/shared.ts`.
3. If registered: spread `registration` into `registry/{category}.ts`, and add the component `name` to the matching menu group in `registration/insert-menus.ts`.
4. Add co-located `{Name}.stories.tsx`; export the folder from `packages/components/index.ts`.
5. Run `pnpm build`, `pnpm lint`, `pnpm build:storybook` — all green.
6. Prefer the `/new-component` scaffold command.

### Component rules
- **DO** keep prop interfaces in `index.tsx`, simple (no `Omit`/`Pick`/`NonNullable`).
- **DO** import inputs/`withImage` from `registry/shared.ts` only.
- **DO** give every input `helperText`.
- **DO** model every link field as `type: "CMSLink"`, type it `LinkValue`, and resolve it with `resolveLinkHref` (section 6.4).
- **DON'T** import sibling components from `@repo/components` inside a story — use relative paths (self-import breaks the Storybook build).
- **DON'T** split registration logic across the app and package incorrectly: the **package** provides defaults, the **app** owns the final list, menus, and tokens.

---

## 7. Storybook

- Stories are **co-located** with components (`{Name}.stories.tsx`), not under `apps/storybook/stories/`. The Storybook glob picks them up.
- Import `Meta`/`StoryObj` from `@storybook/nextjs-vite`. Import the component from `./index`; import siblings by relative path.
- Update stories whenever a component's interface changes.
- Build with `pnpm build:storybook`.

---

## 8. Linting & TypeScript

ESLint 9 **flat config** at `apps/app-0/eslint.config.mjs`:
```js
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
  }},
  { files: ["*.config.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  ...storybook.configs["flat/recommended"],
];
```
- `any` is **allowed** (rule off) — but prefer real types where practical.
- Unused vars are a **warning**, not an error — still clean them up.
- `*.config.js` (Tailwind/PostCSS) may use CommonJS `require`.

### Lint/TS rules
- **DO** run `pnpm lint` after changes and resolve warnings you introduced.
- **DO** keep prop interfaces simple (§0.6).
- **DON'T** add new lint rules without a reason; match the existing flat-config style.

---

## 9. Build, verify & commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | App at http://localhost:3000 |
| `pnpm build` | Build the app (excludes Storybook) |
| `pnpm build-all` | Build everything incl. Storybook |
| `pnpm lint` | Lint |
| `pnpm storybook` | Storybook at http://localhost:6006 |
| `pnpm build:storybook` | Build Storybook |
| `pnpm --filter app-0 init:builder` | Seed Builder models (incl. `url-redirect`) |

**Definition of done for any change:** `pnpm build` ✅, `pnpm lint` ✅, and `pnpm build:storybook` ✅ if components/stories changed.

---

## 10. Builder.io Gen 2 integration notes

- Content is fetched **on the server** with `fetchOneEntry` (single) / `fetchEntries` (list) and rendered with `<Content>`.
- Pass `apiKey`, `model`, and use `options: { noTargeting: true }` for global/locale-independent models (e.g. `site-context`, `url-redirect`).
- Use `enrich: true` and `locale` for localized content.
- Detect the editor with `isPreviewing` / `isEditing`; this repo derives server-side preview from `searchParams` (`builder.preview`, `builder.space`, `builder.overrides.preview`) in `page-utils.ts`.
- Centralize Builder constants in `lib/builder.ts` (`BUILDER_API_KEY`, `SITE_CONTEXT_NAME`).
- `generateStaticParams` enumerates `page` URLs (excluding routes with their own implementations like `/blogs`) for static generation.

---

## Quick reference — the rules that bite

- pnpm only; never npm/yarn.
- `pnpm build` + `pnpm lint` green before done; `build:storybook` too if components changed.
- No version bumps in PRs.
- placehold.co images need `.png`.
- No `Math.random()` in render (hydration).
- Simple prop interfaces — no `Omit`/`Pick`/`NonNullable`.
- Self-contained component folders; inputs + `withImage()` from `registry/shared.ts`.
- Theme via `--theme-*` Tailwind classes; never hardcode hex; update **all** theme files when adding a slot.
- Every link field is a `CMSLink` input; resolve with `resolveLinkHref`, never read `.href` directly.
- Redirects live in Builder's `url-redirect` model; build-time, fail-open.
- `proxy.ts` (not `middleware.ts`); keep the matcher tight for MIU.
- `revalidate` is always a literal; wrap reused fetches in `React.cache()`.
