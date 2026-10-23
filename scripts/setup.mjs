/**
 * First-run setup for the Builder.io App Router template.
 *
 * Run from the repo root after cloning:
 *
 *   pnpm configure
 *
 * NOTE: Use `pnpm configure`, NOT `pnpm setup` — `pnpm setup` is a reserved
 * pnpm built-in that configures the shell environment and ignores this script.
 *
 * It will:
 *   1. Prompt for your Builder.io public + private API keys and write them into
 *      the main app's .env.local (preserving any other settings).
 *   2. Optionally rename the placeholder `app-0` app to something of your own,
 *      updating every reference across the monorepo and moving the directory.
 *   3. Prompt for the Builder space Site URL and Description and store them in
 *      .env.local so the seed script can apply them to the space via the Admin API.
 *   4. Seed the Builder space (runs `init:builder`) so the `site-context`,
 *      `article`, and `page` models exist, the home page is seeded at `/`,
 *      the space siteUrl + description are updated, and the app builds.
 *      When another site app has its own space, it first asks whether to use
 *      the template's baseline models or copy that site's models.
 *
 * This runs from the repo root (not from inside the app), so it can safely
 * rename the app directory as the final step. After a rename you must re-run
 * `pnpm install` to regenerate the lockfile for the new path.
 *
 * Once the repo is configured (the `app-0` placeholder has been renamed),
 * re-running `pnpm configure` first asks whether to create another site. Yes
 * runs the add-site flow (scripts/lib/add-site.mjs): it copies an existing site
 * app to apps/<name> with its own port, .env.local, root dev/build scripts and
 * (optionally) a seeded Builder space. No picks an existing site and re-runs
 * the steps above for it.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { ROOT, APPS_DIR, findSiteApps, isConfigured } from "./lib/apps.mjs";
import { askWithDefault, askYesNo, askChoice, cancel, closePrompt } from "./lib/prompt.mjs";
import { upsertEnv, readEnvValue, replaceAppNameInFile, isValidAppName } from "./lib/files.mjs";
import { addSite } from "./lib/add-site.mjs";
import { askModelSourceArgs } from "./lib/model-source.mjs";

const PROJECT_CONFIG_PATH = join(ROOT, ".claude", "project-config.md");

function readProjectConfig() {
  return existsSync(PROJECT_CONFIG_PATH) ? readFileSync(PROJECT_CONFIG_PATH, "utf8") : "";
}

// Extra sites added by `pnpm configure` record their Vercel project as
// "- Project name (<app>): ..." lines alongside the primary "- Project name:".
function readSiteVercelLines() {
  return readProjectConfig().match(/^- Project name \(.+\):.*$/gm) || [];
}

// The project-config label holding this app's Vercel project name.
function vercelLabelFor(app) {
  const siteLabel = `Project name (${app.dir})`;
  return readConfigValue(siteLabel) !== null ? siteLabel : "Project name";
}

// --- Write .claude/project-config.md from collected integration values ---
function writeProjectConfig({ jira, vercelLabel, vercelProject }) {
  let primaryProject = readConfigValue("Project name") || "";
  let siteLines = readSiteVercelLines();
  if (vercelLabel === "Project name") {
    primaryProject = vercelProject || "";
  } else {
    siteLines = siteLines.map((line) =>
      line.startsWith(`- ${vercelLabel}:`) ? `- ${vercelLabel}: ${vercelProject}` : line
    );
  }
  const content = `# Project Config (read by .claude/commands/*)

This file holds the per-project values the Claude Code commands need. It is
populated by \`pnpm configure\`. You can also edit it by hand.

## Jira
- Configured: ${jira ? "yes" : "no"}
- Project key: ${jira ? jira.projectKey : ""}
- Cloud ID: ${jira ? jira.cloudId : ""}
- Base URL: ${jira ? jira.baseUrl : ""}

## Vercel
${["- Project name: " + primaryProject, ...siteLines].join("\n")}
`;
  writeFileSync(PROJECT_CONFIG_PATH, content);
  return PROJECT_CONFIG_PATH;
}

// --- Read an existing project-config.md value (null when the line is absent) ---
function readConfigValue(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = readProjectConfig().match(new RegExp(`^- ${escaped}:[ \\t]*(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

async function configureSite(app) {
  console.log(`Site app: apps/${app.dir} (package "${app.name}")`);
  console.log("Nothing is written until you confirm at the end. Press Ctrl+C at any prompt to cancel.\n");

  // --- 1. Credentials ---
  const envPath = join(app.path, ".env.local");
  let envContent = existsSync(envPath)
    ? readFileSync(envPath, "utf8")
    : readFileSync(join(ROOT, "env.example"), "utf8");

  const currentPublic = readEnvValue(envContent, "NEXT_PUBLIC_BUILDER_API_KEY");
  const currentPrivate = readEnvValue(envContent, "BUILDER_PRIVATE_KEY");

  console.log("Enter your Builder.io API keys (https://builder.io → Account → API Keys):\n");
  const publicKey = await askWithDefault(
    "Public API key",
    // The env.example ships a placeholder; don't treat it as a real default.
    currentPublic === "aa26d0ed43ef421da301a1603f38faeb" ? "" : currentPublic
  );
  const privateKey = await askWithDefault("Private API key (bpk-...)", currentPrivate, {
    mask: true,
  });

  if (!publicKey || !privateKey) {
    console.error("\n✗ Both a public and private key are required. Aborting.");
    process.exit(1);
  }

  envContent = upsertEnv(envContent, "NEXT_PUBLIC_BUILDER_API_KEY", publicKey);
  envContent = upsertEnv(envContent, "BUILDER_PRIVATE_KEY", privateKey);

  // --- 1b. App name (optionally renames the app and sets NEXT_PUBLIC_SITE_CONTEXT_NAME) ---
  let appName = app.dir;
  {
    while (true) {
      const candidate = (await askWithDefault(
        "App name — type a new name to rename it (lowercase letters, numbers, dashes)",
        app.dir
      )).toLowerCase();
      if (!candidate || candidate === app.dir) {
        // Keep current name — no rename needed.
        break;
      }
      if (!isValidAppName(candidate)) {
        console.log("  Name must start with a letter and contain only lowercase letters, numbers, and dashes.");
        continue;
      }
      if (existsSync(join(APPS_DIR, candidate))) {
        console.log(`  apps/${candidate} already exists — pick a different name.`);
        continue;
      }
      appName = candidate;
      break;
    }
  }
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_SITE_CONTEXT_NAME", appName);

  // --- 1c. Builder space settings (siteUrl + description) ---
  console.log("\nBuilder space settings (used by the editor preview and Builder UI):");
  const builderSiteUrl = await askWithDefault(
    "Site URL (the URL where your app runs, e.g. http://localhost:3000)",
    readEnvValue(envContent, "BUILDER_SITE_URL") || "http://localhost:3000"
  );
  const builderSpaceDescription = await askWithDefault(
    "Space description",
    readEnvValue(envContent, "BUILDER_SPACE_DESCRIPTION") ||
      `${appName} — Builder App Router Template`
  );
  envContent = upsertEnv(envContent, "BUILDER_SITE_URL", builderSiteUrl);
  envContent = upsertEnv(
    envContent,
    "BUILDER_SPACE_DESCRIPTION",
    builderSpaceDescription
  );

  // --- 1d. Claude Code command integrations (Jira + Vercel) ---
  console.log("\nClaude Code command config (.claude/project-config.md):");
  // project-config.md is shared by every site, so an existing Jira config is
  // kept unless the user chooses to change it.
  const existingJira = readConfigValue("Configured") === "yes"
    ? {
        projectKey: readConfigValue("Project key") || "",
        cloudId: readConfigValue("Cloud ID") || "",
        baseUrl: readConfigValue("Base URL") || "",
      }
    : null;
  let jira = existingJira;
  const jiraQuestion = existingJira
    ? `Jira is configured for ${existingJira.projectKey}. Change it?`
    : "Configure Jira integration for the Claude Code commands?";
  if (await askYesNo(jiraQuestion)) {
    jira = null;
    // Reconstruct a sample URL from existing config so re-running setup pre-fills nicely.
    const existingKey = readConfigValue("Project key") || "";
    const existingBase = readConfigValue("Base URL") || "";
    const candidate = (existingKey && existingBase) ? `${existingBase}${existingKey}-1` : "";
    const defaultJiraUrl = /^https?:\/\//.test(candidate) ? candidate : "";

    let parsed = false;
    while (!parsed) {
      const jiraUrl = await askWithDefault(
        "  Paste a Jira ticket URL (e.g. https://yourorg.atlassian.net/browse/PROJ-1)",
        defaultJiraUrl
      );
      if (!jiraUrl) {
        console.log("  Skipping Jira config.");
        break;
      }
      const m = jiraUrl.match(/^(https?:\/\/([^/]+)\/browse\/)([A-Za-z][A-Za-z0-9]*)-\d+/i);
      if (!m) {
        console.log("  Could not parse that URL. Expected format: https://yourorg.atlassian.net/browse/PROJ-1");
        continue;
      }
      jira = {
        projectKey: m[3].toUpperCase(),
        cloudId: `https://${m[2]}`,
        baseUrl: m[1],
      };
      parsed = true;
    }
  }
  const vercelLabel = vercelLabelFor(app);
  const vercelProject = await askWithDefault(
    "Vercel project name (for preview-deployment detection)",
    readConfigValue(vercelLabel) || appName
  );

  // --- 1e. Where the space's models come from (only asked when another site has its own space) ---
  const modelArgs = await askModelSourceArgs(findSiteApps(), app.dir, privateKey);
  const seedArgs = ["--filter", app.name, "init:builder", ...modelArgs];

  // --- 2. Confirm, then write ---
  const newName = appName !== app.dir ? appName : null;
  console.log("\nSummary:");
  console.log(`  Site            apps/${app.dir}${newName ? ` → renamed to apps/${newName}` : ""}`);
  console.log(`  Builder keys    saved to apps/${app.dir}/.env.local`);
  console.log(`  Models          ${modelArgs.length ? `copied from ${modelArgs[0].split("=")[1]}'s space` : "template baseline"}`);
  if (modelArgs.length) {
    console.log("  ⚠ Copying replaces every model in this space that has the same name as one in the");
    console.log("    source space (its own webhooks are kept), and the seed rewrites the home page at /.");
  }
  console.log(`  Site URL        ${builderSiteUrl}`);
  console.log(`  Description     ${builderSpaceDescription}`);
  console.log(`  Jira            ${jira ? jira.projectKey : "not configured"}`);
  console.log(`  Vercel project  ${vercelProject}`);
  if (!await askYesNo("Apply this configuration and seed the Builder space?", false)) cancel();

  writeFileSync(envPath, envContent);
  console.log(`\n✓ Wrote apps/${app.dir}/.env.local`);
  const cfgPath = writeProjectConfig({ jira, vercelLabel, vercelProject });
  console.log(`✓ Wrote ${cfgPath.replace(ROOT + "/", "")}`);

  // --- 3. Seed Builder models/content (before any rename, using the current name) ---
  console.log(`\nSeeding Builder models (pnpm ${seedArgs.join(" ")})...\n`);
  const seed = spawnSync("pnpm", seedArgs, {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (seed.status !== 0) {
    console.error("\n✗ Seeding failed. Fix the error above and re-run `pnpm configure`.");
    process.exit(1);
  }

  // --- 4. Perform the rename last (filesystem move + every reference) ---
  if (newName) {
    console.log(`\nRenaming "${app.dir}" → "${newName}"...`);
    const filesToUpdate = [
      join(ROOT, "package.json"),
      join(ROOT, "README.md"),
      join(ROOT, "CLAUDE.md"),
      join(ROOT, "env.example"),
      join(APPS_DIR, "storybook", ".storybook", "preview.ts"),
      join(APPS_DIR, "storybook", "postcss.config.mjs"),
      join(app.path, "package.json"),
      join(ROOT, ".claude", "project-config.md"),
    ];
    for (const file of filesToUpdate) replaceAppNameInFile(file, app.dir, newName);
    renameSync(app.path, join(APPS_DIR, newName));
    console.log(`✓ Renamed app to "${newName}".`);
    console.log(
      "\n⚠ Run `pnpm install` to regenerate the lockfile for the new path before `pnpm dev`."
    );
  }

}

async function main() {
  console.log("\nBuilder.io App Router template — setup\n");

  const apps = findSiteApps();
  if (!isConfigured()) {
    await configureSite(apps[0]);
  } else {
    console.log(`This repository is already configured (sites: ${apps.map((a) => a.dir).join(", ")}).`);
    if (await askYesNo("Create another site?")) {
      await addSite(apps);
    } else {
      const app = apps.length === 1
        ? apps[0]
        : apps[await askChoice("Reconfigure which site?", apps.map((a) => a.dir))];
      console.log();
      await configureSite(app);
    }
  }

  console.log("\n✓ Setup complete.\n");
  closePrompt();
}

main().catch((err) => {
  console.error("\n✗ Setup failed:", err.message || err);
  process.exit(1);
});
