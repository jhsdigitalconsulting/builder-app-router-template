/**
 * Helpers for locating the site apps in this monorepo. Shared by
 * `scripts/setup.mjs` and `scripts/seed-builder.mjs`.
 *
 * A "site app" is any workspace under apps/ that depends on
 * @builder.io/sdk-react (i.e. everything except Storybook).
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..", "..");
export const APPS_DIR = join(ROOT, "apps");

// The placeholder app the template ships with. While it exists the repo has
// not been configured yet; once it's renamed, the repo is configured.
export const TEMPLATE_APP_DIR = "app-0";

export const DEFAULT_PORT = 3000;

// Reads the `-p <port>` flag from the app's `dev` script.
function readDevPort(pkg) {
  const match = (pkg.scripts?.dev || "").match(/-p\s+(\d+)/);
  return match ? Number(match[1]) : DEFAULT_PORT;
}

export function findSiteApps() {
  const apps = [];
  for (const entry of readdirSync(APPS_DIR).sort()) {
    const pkgPath = join(APPS_DIR, entry, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (pkg.name !== "storybook-app" && deps["@builder.io/sdk-react"]) {
      apps.push({
        dir: entry,
        name: pkg.name,
        path: join(APPS_DIR, entry),
        port: readDevPort(pkg),
      });
    }
  }
  if (!apps.length) throw new Error("Could not find a site app under apps/.");
  return apps;
}

// The app a script should act on: the one whose directory we're running in
// (`pnpm --filter <app> <script>` runs from the app dir), otherwise the first.
export function findCurrentApp() {
  const apps = findSiteApps();
  const cwd = resolve(process.cwd());
  return apps.find((app) => cwd === app.path || cwd.startsWith(`${app.path}/`)) || apps[0];
}

export function isConfigured() {
  return !existsSync(join(APPS_DIR, TEMPLATE_APP_DIR));
}

export function nextFreePort(apps) {
  return Math.max(...apps.map((app) => app.port)) + 1;
}
