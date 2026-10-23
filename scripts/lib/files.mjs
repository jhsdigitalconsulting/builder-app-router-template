/**
 * Small file-editing helpers shared by the setup flows.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- .env.local writing: preserve existing lines, upsert a key ---
export function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return `${content.replace(/\n*$/, "")}\n${line}\n`;
}

export function readEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

// An app's BUILDER_PRIVATE_KEY from its .env.local, or "" when it has none.
export function readPrivateKey(app) {
  const envPath = join(app.path, ".env.local");
  return existsSync(envPath)
    ? readEnvValue(readFileSync(envPath, "utf8"), "BUILDER_PRIVATE_KEY")
    : "";
}

// --- Replace every occurrence of a token across a file ---
export function replaceInFile(filePath, from, to) {
  if (!existsSync(filePath)) return;
  const original = readFileSync(filePath, "utf8");
  const updated = original.split(from).join(to);
  if (updated !== original) writeFileSync(filePath, updated);
}

// Replaces an app name only where it stands alone, so renaming `acme` leaves
// `acme-blog` or `acme-web` untouched.
export function replaceAppNameInFile(filePath, from, to) {
  if (!existsSync(filePath)) return;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![a-z0-9-])${escaped}(?![a-z0-9-])`, "g");
  const original = readFileSync(filePath, "utf8");
  const updated = original.replace(pattern, to);
  if (updated !== original) writeFileSync(filePath, updated);
}

export function isValidAppName(name) {
  return /^[a-z][a-z0-9-]*$/.test(name);
}
