# Component Architecture Pattern

This is the canonical pattern for components in `@repo/components`. Every component —
whether or not it is registered with Builder.io — follows it. The goal is that a
component can be added or removed by touching **one folder**, and that the *choice* of
which components, insert menus, and design tokens an app ships lives in the **app
layer**, not the shared package.

> Quick start: run the `/new-component` command, which scaffolds all of this for you and
> asks whether the component should be registered with Builder.io.

---

## 1. Self-contained component folders

Each component lives in its own folder named after the component, under the appropriate
category (`ui`, `cta`, `layout`, `navigation`, `seo`, `common`):

```
packages/components/components/{category}/{Name}/
├── index.tsx                        # the component + its Props interface (required)
├── {Name}.builder.registration.tsx  # Builder.io registration (ONLY if registered)
└── {Name}.stories.tsx               # Storybook story (required)
```

Rules:

- **`index.tsx`** holds the primary component and its `Props` interface. Export it both
  named and default (`export { Name }; export default Name;`) so both import styles
  resolve. If the component exceeds ~100 lines or needs sub-components/helpers, split
  them into sibling files in the same folder and keep the primary component + `Props` in
  `index.tsx` (per the global splitting rule).
- **Define interfaces simply** — no `Omit`, `NonNullable`, or other utility-type gymnastics.
- The package barrel `packages/components/index.ts` exports each component by **folder
  path** (`export * from './components/ui/Button'`), which resolves to `index.tsx`
  automatically. Add a line here for every new component.

Folder depth note: from `{category}/{Name}/`, the path up to `registry/shared` is
`../../../registry/shared`, and to a sibling category component is `../../{other}/{Name}`.

---

## 2. The Builder.io registration file (registered components only)

Components that should appear in / be controlled by the Builder.io editor get a
`{Name}.builder.registration.tsx` beside `index.tsx`.

**Contract: it always exports `registration: RegisteredComponent[]` (an array).** An
array — even for a single entry — cleanly handles components that register more than once
(e.g. Button's hidden `Core:Button` override + the visible `Button`).

```tsx
import type { RegisteredComponent } from "@builder.io/sdk-react";
import { themeableInputs, withImage, type Inputs } from "../../../registry/shared";
import MyComponent from "./index";

export const registration: RegisteredComponent[] = [
  {
    component: MyComponent,
    name: "MyComponent",
    ...withImage(),            // pulls NEXT_DEFAULT_COMPONENT_IMAGE if set
    inputs: [
      ...themeableInputs,
      { name: "title", type: "string", defaultValue: "Hello", helperText: "..." },
    ],
  },
];
```

- **`withImage()`** (from `registry/shared`) injects the default editor thumbnail from the
  `NEXT_DEFAULT_COMPONENT_IMAGE` env var. Use it on every registration.
- **Shared input bundles** live in `registry/shared.ts`, already widened to the SDK's
  `Inputs` type so the `as unknown as Inputs` cast lives in exactly one place. Available:
  `commonInputs`, `themeableInputs`, `heroicInputs`, `alignableInputs`, `opacityInputs`,
  `buttonInputs`, `ctaInputs`, `backgroundInputs`, `reversibleInputs`, plus
  `standardThemes` / `backgroundTypes` (string arrays) and the `Inputs` type. Import shared
  bundles from here — never re-cast in a component file.
- Preserve component-specific flags verbatim where they apply: `shouldReceiveBuilderProps`,
  `canHaveChildren` / `childRequirements`, `noWrap`, `hideFromInsertMenu`, `override`,
  `defaults.bindings`, `defaultStyles`.
- **Default images** must be `placehold.co` URLs with a `.png` extension.

### Non-registered components

Helpers and library components that are **not** placed in the editor (e.g.
`common/ThemeProvider`, `navigation/DefaultHeader`, `seo/buildPageMetadata`,
`seo/PageSchema`, the schema-data components) follow the exact same folder structure but
**omit** the `.builder.registration.tsx` file. They still get an `index.tsx` and a story.

---

## 3. Category barrels and the combined list

Registrations are wired up through thin barrels — you never hand-edit a giant registry
file:

- **`registry/{category}.ts`** imports each component's `registration` and concatenates
  them in display order:

  ```ts
  import type { RegisteredComponent } from "@builder.io/sdk-react";
  import { registration as button } from "../components/ui/Button/Button.builder.registration";
  import { registration as headline } from "../components/ui/Headline/Headline.builder.registration";

  export const uiComponents: RegisteredComponent[] = [...button, ...headline];
  ```

- **`registry/index.ts`** concatenates the category arrays into `customComponents` (and
  re-exports each category array). No change needed here when adding a component to an
  existing category — only the category barrel changes.

---

## 4. App-layer ownership

The shared package provides **defaults**; the app (`apps/app-0`) decides what actually
ships to its Builder.io editor:

- **`apps/app-0/registry/index.ts`** — composes the final `customComponents` (defaults to
  the package's full list; can omit / override / append).
- **`apps/app-0/registry/insert-menus.ts`** — chooses which menus appear (defaults to all
  of the package's `INSERT_MENUS`).
- **`apps/app-0/registry/design-tokens.ts`** — package metric tokens merged with app colors.
- **`apps/app-0/registry/register.ts`** (`"use client"`) — the **only** place that calls
  `register("insertMenu", ...)` / `registerDesignTokens(...)`.

### Insert menus

A registered component only shows up in the editor's "+" menu if its `name` is listed in
an insert menu. The package's default menus live in
`packages/components/registration/insert-menus.ts` (`INSERT_MENUS`, grouped: Navigation,
UI, CTA, Layout, SEO). Add the component's `name` to the matching menu group there to make
it available by default. A component registered but absent from every menu (e.g. a hidden
override, or `DesignKitOverview`) still renders — it just can't be inserted from the menu.

---

## 5. Storybook

- Every component gets a `{Name}.stories.tsx` **co-located in its folder**.
- Import the primary component from `./index`; import sibling components by relative path
  (`../../{category}/{Name}`) — **never** from `@repo/components` (a self-import the
  Storybook Vite build cannot resolve from inside the package).
- Import `Meta` / `StoryObj` from `@storybook/nextjs-vite`.
- The Storybook glob (`apps/storybook/.storybook/main.ts`) already picks up
  `packages/components/components/**/*.stories.@(ts|tsx)` — no config change per component.

---

## 6. Checklist for a new component

1. `packages/components/components/{category}/{Name}/index.tsx` — component + `Props`,
   named + default export.
2. **If registered:** `{Name}.builder.registration.tsx` exporting
   `registration: RegisteredComponent[]`, using `withImage()` and shared input bundles.
3. **If registered:** add `...{name}` to the matching `registry/{category}.ts` barrel.
4. **If registered:** add the component's `name` to the right group in
   `packages/components/registration/insert-menus.ts`.
5. **If it has links:** every link input is `type: "CMSLink"`, the prop is typed
   `LinkValue`, and it renders via `resolveLinkHref` from `utils/links.ts` (see
   `docs/DESIGN_PATTERNS.md` section 6.4).
6. `{Name}.stories.tsx` co-located, importing from `./index`.
7. Export the folder from `packages/components/index.ts`.
8. `pnpm build`, `pnpm lint`, and `pnpm build:storybook` — all green.
