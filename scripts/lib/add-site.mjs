/**
 * "Add another site" flow for `pnpm configure`, offered once the repo has been
 * configured (the template's `app-0` placeholder has been renamed).
 *
 * It copies an existing site app to apps/<name> (minus build output, deps and
 * secrets), gives it its own dev port, writes its .env.local, adds
 * `dev:<name>` / `build:<name>` root scripts, records its Vercel project in
 * .claude/project-config.md, installs, and optionally seeds its Builder space.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { basename, join } from "node:path";
import { ROOT, APPS_DIR, nextFreePort } from "./apps.mjs";
import { ask, askWithDefault, askYesNo, askChoice } from "./prompt.mjs";
import { upsertEnv, replaceInFile, isValidAppName } from "./files.mjs";

// Never copied into the new app: build output, installed deps and secrets.
const SKIPPED_ENTRIES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".vercel",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
]);

function shouldCopy(src) {
  const name = basename(src);
  if (SKIPPED_ENTRIES.has(name)) return false;
  return !(name.startsWith(".env") && name !== ".env.example");
}

async function askNewAppName() {
  while (true) {
    const name = (await ask(
      "New site app name (lowercase, letters/numbers/dashes): "
    )).toLowerCase();
    if (!name) {
      console.log("  A name is required.");
      continue;
    }
    if (!isValidAppName(name)) {
      console.log("  Name must start with a letter and contain only lowercase letters, numbers, and dashes.");
      continue;
    }
    if (existsSync(join(APPS_DIR, name))) {
      console.log(`  apps/${name} already exists — pick a different name.`);
      continue;
    }
    return name;
  }
}

async function askPort(defaultPort, takenPorts) {
  while (true) {
    const port = Number(await askWithDefault("Dev server port", String(defaultPort)));
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      console.log("  Enter a port between 1024 and 65535.");
      continue;
    }
    if (takenPorts.includes(port)) {
      console.log(`  Port ${port} is already used by another site.`);
      continue;
    }
    return port;
  }
}

// Returns { publicKey, privateKey }, either of which may be "" (set them later).
async function askBuilderKeys(source) {
  console.log(
    "\nBuilder.io space for the new site. Each site normally gets its own space —"
  );
  console.log(
    "the page model (including the home page at /) is shared by everything in a space."
  );
  if (await askYesNo(`Reuse the Builder space from ${source.dir}?`)) {
    const sourceEnvPath = join(source.path, ".env.local");
    const sourceEnv = existsSync(sourceEnvPath) ? readFileSync(sourceEnvPath, "utf8") : "";
    const read = (key) => (sourceEnv.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] || "").trim();
    return {
      publicKey: read("NEXT_PUBLIC_BUILDER_API_KEY"),
      privateKey: read("BUILDER_PRIVATE_KEY"),
    };
  }
  console.log("Enter the new space's API keys (https://builder.io → Account → API Keys).");
  console.log("Press Enter to skip and add them to .env.local later.\n");
  const publicKey = await ask("Public API key: ");
  const privateKey = await ask("Private API key (bpk-...): ", { mask: true });
  return { publicKey, privateKey };
}

function writeAppPackageJson(appPath, name, port) {
  const pkgPath = join(appPath, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = name;
  for (const script of ["dev", "start"]) {
    if (pkg.scripts?.[script]) {
      pkg.scripts[script] = pkg.scripts[script].replace(/-p\s+\d+/, `-p ${port}`);
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Adds dev:<name> / build:<name> right after the source app's scripts.
function addRootScripts(source, name) {
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const added = {
    [`dev:${name}`]: `turbo run dev --filter=${name}`,
    [`build:${name}`]: `turbo run build --filter=${name}`,
  };
  const scripts = {};
  for (const [key, value] of Object.entries(pkg.scripts)) {
    scripts[key] = value;
    if (key === `dev:${source.name}`) scripts[`dev:${name}`] = added[`dev:${name}`];
    if (key === `build:${source.name}`) scripts[`build:${name}`] = added[`build:${name}`];
  }
  // Keys already placed above keep their position; missing ones are appended.
  pkg.scripts = { ...scripts, ...added };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Records "- Project name (<app>): <project>" under the ## Vercel heading.
function recordVercelProject(name, vercelProject) {
  const path = join(ROOT, ".claude", "project-config.md");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  const line = `- Project name (${name}): ${vercelProject}`;
  const re = new RegExp(`^- Project name \\(${name}\\):.*$`, "m");
  const updated = re.test(content)
    ? content.replace(re, line)
    : content.replace(/(## Vercel\n(?:- .*\n?)*)/, (block) => `${block.replace(/\n*$/, "")}\n${line}\n`);
  writeFileSync(path, updated);
}

export async function addSite(apps) {
  console.log("\nAdd another site\n");

  const source = apps.length === 1
    ? apps[0]
    : apps[await askChoice("Copy which existing site as the starting point?", apps.map((a) => a.dir))];
  console.log(`Starting point: apps/${source.dir}\n`);

  const name = await askNewAppName();
  const port = await askPort(nextFreePort(apps), apps.map((a) => a.port));
  const { publicKey, privateKey } = await askBuilderKeys(source);

  console.log("\nBuilder space settings (used by the editor preview and Builder UI):");
  const siteUrl = await askWithDefault(
    "Site URL (the URL where your app runs)",
    `http://localhost:${port}`
  );
  const description = await askWithDefault(
    "Space description",
    `${name} — Builder App Router Template`
  );
  const vercelProject = await askWithDefault(
    "Vercel project name (for preview-deployment detection)",
    name
  );

  // --- Copy the app and give it its own identity ---
  const appPath = join(APPS_DIR, name);
  cpSync(source.path, appPath, { recursive: true, filter: shouldCopy });
  writeAppPackageJson(appPath, name, port);
  replaceInFile(join(appPath, ".env.example"), source.dir, name);
  console.log(`\n✓ Copied apps/${source.dir} → apps/${name} (port ${port})`);

  let envContent = readFileSync(join(ROOT, "env.example"), "utf8");
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_BUILDER_API_KEY", publicKey);
  envContent = upsertEnv(envContent, "BUILDER_PRIVATE_KEY", privateKey);
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_SITE_CONTEXT_NAME", name);
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_SITE_URL", `http://localhost:${port}`);
  envContent = upsertEnv(envContent, "BUILDER_SITE_URL", siteUrl);
  envContent = upsertEnv(envContent, "BUILDER_SPACE_DESCRIPTION", description);
  writeFileSync(join(appPath, ".env.local"), envContent);
  console.log(`✓ Wrote apps/${name}/.env.local`);

  addRootScripts(source, name);
  console.log(`✓ Added dev:${name} and build:${name} to the root package.json`);

  recordVercelProject(name, vercelProject);
  console.log("✓ Recorded the Vercel project in .claude/project-config.md");

  // --- Link the new workspace into the lockfile ---
  console.log("\nInstalling dependencies (pnpm install)...\n");
  const install = spawnSync("pnpm", ["install"], { cwd: ROOT, stdio: "inherit" });
  if (install.status !== 0) {
    console.error("\n✗ pnpm install failed. Fix the error above, then run `pnpm install`.");
    process.exit(1);
  }

  // --- Seed the new site's Builder space ---
  if (!publicKey || !privateKey) {
    console.log(`\n⚠ No Builder keys yet. Add them to apps/${name}/.env.local, then run:`);
    console.log(`  pnpm --filter ${name} init:builder`);
  } else if (await askYesNo(`Seed the Builder space for ${name} now?`, false)) {
    const seed = spawnSync("pnpm", ["--filter", name, "init:builder"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (seed.status !== 0) {
      console.error(`\n✗ Seeding failed. Fix the error above and run \`pnpm --filter ${name} init:builder\`.`);
      process.exit(1);
    }
  }

  console.log(`\n✓ Site "${name}" created. Next steps:`);
  console.log(`  • pnpm dev:${name}  →  http://localhost:${port}`);
  console.log(`  • Create the "${vercelProject}" Vercel project with Root Directory apps/${name}`);
  console.log(`  • Document the new app in CLAUDE.md / README.md`);
}
