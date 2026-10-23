/**
 * Asks where a site's Builder models should come from when its space is
 * seeded: the template's baseline models, or a copy of another site's models
 * (see scripts/lib/copy-models.mjs). Used when reconfiguring a site; the
 * add-site flow asks "fresh or copy" up front instead.
 */

import { askChoice } from "./prompt.mjs";
import { readPrivateKey } from "./files.mjs";

// Returns the init:builder args for the chosen model source: [] for the
// baseline models, or ["--models-from=<dir>"] to copy another site's models.
// Only sites with their own Builder space (a different private key) are offered.
export async function askModelSourceArgs(apps, targetDir, targetPrivateKey) {
  const sources = apps.filter((app) => {
    if (app.dir === targetDir) return false;
    const key = readPrivateKey(app);
    return key && key !== targetPrivateKey;
  });
  if (!sources.length) return [];

  const choice = await askChoice("Model configuration for this Builder space", [
    "Baseline models from the template",
    ...sources.map((app) => `Copy the models from ${app.dir}'s space (as they are now, including Builder UI changes)`),
  ]);
  return choice === 0 ? [] : [`--models-from=${sources[choice - 1].dir}`];
}
