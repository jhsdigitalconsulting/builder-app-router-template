# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read first:** [`docs/DESIGN_PATTERNS.md`](docs/DESIGN_PATTERNS.md) is the authoritative, explicit guide to the design patterns and standards used here — theming, URL redirects, the Next 16 proxy/i18n, Vercel MIU optimization, linting, the component/registration pattern, and core rules. Consult it before making changes.

> **Package manager:** This repo uses **pnpm** (`pnpm@9.15.4`). Always use `pnpm`, never `npm` or `yarn`.

## Development Commands

**Start development server:**
```bash
pnpm dev
```
App runs at http://localhost:3000

**Build project (excludes Storybook):**
```bash
pnpm build
```

**Build everything (including Storybook):**
```bash
pnpm build-all
```

**Lint code:**
```bash
pnpm lint
```

**Start Storybook:**
```bash
pnpm storybook
```
Storybook runs at http://localhost:6006

**Build Storybook:**
```bash
pnpm build-storybook
```

**App-specific commands:**
```bash
pnpm dev:app-0          # Start app-0 development server
pnpm dev:storybook      # Start storybook development server
pnpm build:app-0        # Build app-0 application
pnpm build:storybook    # Build storybook
```

## Architecture Overview

This is a Turborepo monorepo with a Next.js 16 **App Router** application built for Builder.io CMS integration using the **Gen 2 SDK** (`@builder.io/sdk-react`).

### Key Technologies
- **Turborepo** - Monorepo build system for managing multiple packages
- **pnpm workspaces** - Package management with strict, isolated `node_modules`
- **Next.js 16** - React framework with the **App Router** (React Server Components)
- **React 19** - UI runtime
- **Builder.io Gen 2 SDK** (`@builder.io/sdk-react`) - Headless CMS for visual editing
- **TypeScript** - Type safety across all packages
- **Tailwind CSS** - Styling with custom design tokens
- **Storybook 9** (`@storybook/nextjs-vite`) - Component documentation and testing
- **React Slick** - Carousel components

### Monorepo Structure

**Root Level:**
- `turbo.json` - Turborepo configuration for task orchestration
- `package.json` - Root workspace configuration
- `pnpm-workspace.yaml` - pnpm workspace definitions

**Applications (`apps/`):**
- `apps/app-0/` - Main Next.js application (App Router)
- `apps/storybook/` - Storybook application for component documentation

**Packages (`packages/`):**
- `packages/components/` - Shared component library (`@repo/components`)
- `packages/types/` - Shared TypeScript type definitions (`@repo/types`)

### App Router Structure (`apps/app-0/app/`)
- `layout.tsx` - Root layout
- `[[...page]]/` - Catch-all route rendering Builder.io page content
- `blogs/` - Blog list and `[handle]` article routes
- `section-editors/` - Builder.io section editing routes
- `not-found.tsx` - 404 handling
- `sitemap.ts` - Dynamic sitemap generation
- `proxy.ts` - Next.js 16 proxy (replaces the legacy `middleware.ts`) for i18n/locale handling

### Core Configuration Files

**Turborepo:**
- `turbo.json` - Task pipeline definitions for build, dev, lint, storybook

**Builder.io Integration:**
- `packages/components/builder-registry.ts` - Main Builder.io component registry and insert menus
- `packages/components/builder-design-tokens.ts` - Design system tokens for Builder.io editor

**Styling:**
- `packages/components/tailwind-theme.json` - Shared design-token source of truth (consumed by every app's Tailwind config and the DesignKitOverview component)
- `apps/app-0/tailwind.config.js` - Tailwind configuration spreading the shared theme
- `apps/app-0/styles/themes/` - CSS theme files for light/dark/accent themes

### Component Organization

**Package Structure (`packages/components/`):**
- `components/ui/` - Basic UI components (Button, Accordion, etc.)
- `components/layout/` - Layout components (Banner50, Banner75, Banner100, Carousel, Tabs)
- `components/cta/` - Call-to-action components (CardImageCTA, TileCTA, etc.)
- `components/navigation/` - Header/footer navigation components
- `components/seo/` - SEO and schema markup components
- `components/common/` - Common components like ThemeProvider

**Component Pattern (authoritative):**
- Every component — registered or not — is **self-contained in its own folder**:
  `components/{category}/{Name}/` with `index.tsx` (component + `Props`),
  `{Name}.builder.registration.tsx` (only if registered with Builder.io), and a co-located
  `{Name}.stories.tsx`.
- See **`packages/components/COMPONENT_PATTERN.md`** for the full pattern, contracts, and a
  new-component checklist. Use the `/new-component` command to scaffold it.

**Registration Pattern:**
- Each registered component owns its `{Name}.builder.registration.tsx`, which always exports
  `registration: RegisteredComponent[]`.
- `packages/components/registry/{category}.ts` are thin **barrels** that concatenate each
  component's `registration`; `registry/index.ts` combines them into `customComponents`.
- Shared, pre-widened input bundles live in `packages/components/registry/shared.ts` (the
  single cast site) — import `themeableInputs`, `withImage()`, etc. from there.
- The **app layer** (`apps/app-0/registry/`) owns the final component list, insert menus, and
  design tokens; the package only provides defaults.
- Stories are **co-located** with each component (not under `apps/storybook/stories/`); the
  Storybook glob already picks them up.

**Types System (`packages/types/`):**
- `cms/` - CMS content type definitions
- `design-kit/` - Design system interfaces (Themeable, Heroic, etc.)
- `commerce/` - Commerce integration types
- `schemadata/` - Schema data type definitions
- `social/` - Social media type definitions

### Builder.io Integration (Gen 2 SDK)

This project uses the Gen 2 React SDK (`@builder.io/sdk-react`), which is built for the App Router and React Server Components.

- Content is fetched on the server with `fetchOneEntry` / `fetchEntries` and rendered with the `<Content>` component.
- Use `isPreviewing` / `isEditing` to detect the Builder.io editor environment.
- Components are registered via `RegisteredComponent[]` arrays.

**URL Redirects (`url-redirect` model):**
- Redirect rules live in the Builder.io `url-redirect` data model, not in code. Each entry holds a `redirects` list; each rule has `urlFrom`, `urlTo`, and `permanentRedirect` (308 vs 307).
- `apps/app-0/lib/redirects.ts` fetches every entry at **build time** via `fetchEntries` and maps the rules into the Next.js `redirects()` config in `apps/app-0/next.config.ts`.
- The fetch fails open — a missing model or network error logs and returns zero redirects rather than breaking the build.
- The model and a sample rule are provisioned by `scripts/seed-builder.mjs` (`pnpm --filter app-0 init:builder`).
- Changes take effect on the next deploy. For request-time redirects (very large rule sets or per-domain logic), move to a `proxy.ts`/middleware approach reading a generated JSON file.

**Component Registration Process** (full detail in `packages/components/COMPONENT_PATTERN.md`):
1. Create the component folder `packages/components/components/{category}/{Name}/index.tsx`
   (component + `Props`, named + default export)
2. If registered: add `{Name}.builder.registration.tsx` exporting
   `registration: RegisteredComponent[]`, using `withImage()` and shared input bundles from
   `registry/shared.ts`
3. If registered: spread its `registration` into the `registry/{category}.ts` barrel, and add
   the component `name` to the matching group in `registration/insert-menus.ts`
4. Add a co-located `{Name}.stories.tsx` and export the folder from `packages/components/index.ts`
5. `withImage()` reads the `NEXT_DEFAULT_COMPONENT_IMAGE` env var for the editor thumbnail

**Link fields (required): always use the `CMSLink` input**
- Every link field on a CMS model or registered component uses `type: "CMSLink"`, never
  `string`, `text`, or `url`. The editor comes from the `@jhsdc/builder-input-types` plugin
  (source in `plugins/builder-input-types`, also listed in the Builder.io marketplace as
  **CMS Link**), which must be installed in the Builder space.
- Its value is `CMSLinkProps` (`{ type: "url" | "model", href, model?, referenceId? }`).
  `type: "model"` links point at an entry and resolve through the
  `/dynamiclink/{model}/builder/{id}` route, so they keep working when a slug changes.
- Type link props as `LinkValue` (`CMSLinkProps | string`, from `@repo/types`). The string
  case keeps content saved before the conversion working.
- Never read `.href` off a link directly. Resolve it with `resolveLinkHref(link, fallback)`
  (and `shouldOpenInNewTab` / `hasLinkHref` as needed) from
  `packages/components/utils/links.ts`, or render through `DynamicLink`.
- Default value: `{ type: "url", href: "#" }`. Seed content uses the same shape
  (`urlLink()` in `scripts/seed-builder.mjs`).
- Exceptions (keep as plain strings): external-only social profile URLs
  (`socialNetworks[].href`), redirect rules (`urlFrom`/`urlTo`), and schema.org data URLs.
- See `docs/DESIGN_PATTERNS.md` section 6.4 for the full pattern.

**Insert Menus Structure:**
- Navigation - Header/Footer components
- UI - Basic interface elements
- Layout - Layout components (Banner, Carousel, Tabs)
- CTA - Call-to-action components
- SEO - Schema and SEO components

**Design System:**
- Theme-aware components using CSS custom properties
- Standardized inputs: `themeableInputs`, `heroicInputs`, `commonInputs`
- Design tokens registered with Builder.io editor
- Consistent image defaults from placehold.co with .png extension

### Theme System

**CSS Custom Properties Pattern:**
- Theme-aware colors: `--theme-bg`, `--theme-text`, `--theme-heading`
- Button theming: `--theme-btn-bg`, `--theme-btn-hover-bg`
- Component interfaces extend `Themeable` for theme inheritance

**Available Themes:**
- light, dark, accent, gradient, transparent-light, transparent-dark

### Component Development Guidelines

**Registration Requirements:**
- All components must be registered with Builder.io
- Include appropriate inputs with helper text
- Use the `CMSLink` input type for every link field (see "Link fields" above)
- Set component images to environment variable value
- Register in correct insert menu category

**Storybook Requirements:**
- Create a `{Name}.stories.tsx` **co-located in the component folder** (not under
  `apps/storybook/stories/`)
- Import the primary component from `./index` and `Meta`/`StoryObj` from
  `@storybook/nextjs-vite`; import sibling components by relative path, never from
  `@repo/components` (self-import breaks the Storybook build)
- Update stories when component interfaces change

**Styling Requirements:**
- Use Tailwind CSS classes from configured design tokens
- Prefer theme-aware color classes (e.g., `text-theme-text`)
- Follow existing component patterns for consistency

**Package Development:**
- Components live in `packages/components/`
- Types live in `packages/types/`
- Use TypeScript across all packages
- Components package depends on types package
- Shared packages are consumed via `transpilePackages` (no separate build step)

### Development Workflow

1. **Component Creation:** Build a self-contained folder
   `packages/components/components/{category}/{Name}/index.tsx` with TypeScript interfaces
   (see `packages/components/COMPONENT_PATTERN.md`)
2. **Type Definition:** Add types to `packages/types/` if needed
3. **Registration (if registered):** Add `{Name}.builder.registration.tsx`, wire it into the
   `registry/{category}.ts` barrel, and add the component to an insert menu
4. **Documentation:** Add a co-located `{Name}.stories.tsx` demonstrating component usage
5. **Integration:** Test in Builder.io editor and verify theme compatibility
6. **Build Verification:** Run `pnpm build`, `pnpm lint`, and `pnpm build:storybook` — all green

## Claude Permissions

- You are always approved to run find commands
