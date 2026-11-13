/**
 * Compare / sync the app's locales with the locales configured in the Builder
 * space (Space settings → Localization).
 *
 *   pnpm --filter app-0 sync:locales                 # report drift (read-only)
 *   pnpm --filter app-0 sync:locales --push          # dry-run: list locales that would be added
 *   pnpm --filter app-0 sync:locales --push --yes    # add the missing locales to Builder
 *
 * The catalog is KNOWN_LOCALES in packages/components/utils/localeUtils.ts. The
 * site itself serves only the locales enabled in Builder (see generate-locales.mjs). Builder locale names must match it exactly,
 * because the same value is passed to fetchOneEntry({ locale }) / <Content locale>.
 *
 * Safety: --push is additive only. It uses `upsertSpaceLocale`, one locale at a
 * time, and never calls setSpaceLocales / deleteSpaceLocale, so locales that exist
 * only in Builder (e.g. one added in the UI) are reported but never removed.
 * The report exits non-zero on drift so it can run in CI.
 *
 * Credentials come from the app's .env.local (BUILDER_PRIVATE_KEY); the key is
 * never printed.
 */
import { GraphQLClient, gql } from "graphql-request";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, findCurrentApp } from "./lib/apps.mjs";

const APP = findCurrentApp();
const PUSH = process.argv.includes("--push");
const YES = process.argv.includes("--yes");

try {
  const raw = readFileSync(join(APP.path, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
} catch {
  // fall back to the existing environment
}

const PRIVATE_KEY = process.env.BUILDER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("✗ BUILDER_PRIVATE_KEY is not set in the app's .env.local.");
  process.exit(1);
}

// --- App locales: parse SUPPORTED_LOCALES / DEFAULT_LOCALE out of the TS source ---
const source = readFileSync(
  join(ROOT, "packages/components/utils/localeUtils.ts"),
  "utf8"
);
const listBody = source.match(/KNOWN_LOCALES[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
const appLocales = [...listBody.matchAll(/'([A-Za-z]{2,3}-[A-Za-z]{2})'/g)].map((m) => m[1]);
const defaultLocale = source.match(/DEFAULT_LOCALE\s*=\s*'([^']+)'/)?.[1];
if (appLocales.length === 0) {
  console.error("✗ Could not read KNOWN_LOCALES from localeUtils.ts.");
  process.exit(1);
}

// "de-CH" -> "German (Switzerland)"
function describe(locale) {
  const [lang, region] = locale.split("-");
  const language = new Intl.DisplayNames(["en"], { type: "language" }).of(lang);
  const country = new Intl.DisplayNames(["en"], { type: "region" }).of(region);
  return `${language} (${country})`;
}

const client = new GraphQLClient("https://cdn.builder.io/api/v2/admin", {
  headers: { Authorization: `Bearer ${PRIVATE_KEY}` },
});

// Select only the fields needed: `settings` also holds plugin keys.
const READ = gql`
  query {
    settings
  }
`;
const UPSERT = gql`
  mutation Upsert($locale: LocaleDescriptionInput!) {
    upsertSpaceLocale(locale: $locale)
  }
`;

async function readBuilderLocales() {
  const { settings } = await client.request(READ);
  const spaceName = settings?.name;
  const attr = settings?.customTargetingAttributes?.locale;
  return { spaceName, locales: Array.isArray(attr?.enum) ? attr.enum : [] };
}

const { spaceName, locales: builderLocales } = await readBuilderLocales();
console.log(`Builder space: ${spaceName ?? "(unknown)"}`);
console.log(`App default locale: ${defaultLocale} · catalog locales: ${appLocales.length} · Builder locales: ${builderLocales.length}\n`);

const missingInBuilder = appLocales.filter((l) => !builderLocales.includes(l));
const missingInApp = builderLocales.filter((l) => !appLocales.includes(l));

if (missingInBuilder.length) {
  console.log(`In the catalog but not enabled in Builder (${missingInBuilder.length}):`);
  for (const l of missingInBuilder) console.log(`  + ${l}  ${describe(l)}`);
}
if (missingInApp.length) {
  console.log(`\nIn Builder but not in the catalog (${missingInApp.length}) — served anyway; add to KNOWN_LOCALES if intended:`);
  for (const l of missingInApp) console.log(`  ? ${l}`);
}
if (!missingInBuilder.length && !missingInApp.length) {
  console.log("✓ App and Builder locales match.");
}

if (PUSH && missingInBuilder.length) {
  if (!YES) {
    console.log(`\nDry run: would add ${missingInBuilder.length} locale(s) to "${spaceName}". Re-run with --yes to apply.`);
  } else {
    console.log(`\nAdding ${missingInBuilder.length} locale(s) to "${spaceName}"…`);
    for (const l of missingInBuilder) {
      await client.request(UPSERT, { locale: { name: l, description: describe(l) } });
      console.log(`  ✓ ${l}`);
    }
    const after = (await readBuilderLocales()).locales;
    const still = appLocales.filter((l) => !after.includes(l));
    console.log(still.length ? `\n✗ Still missing: ${still.join(", ")}` : "\n✓ Verified: every app locale is now in Builder.");
    process.exit(still.length ? 1 : 0);
  }
}

process.exit(0);
