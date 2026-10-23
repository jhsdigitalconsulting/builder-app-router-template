/**
 * Small file-editing helpers shared by the setup flows.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

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

// --- Replace every occurrence of a token across a file ---
export function replaceInFile(filePath, from, to) {
  if (!existsSync(filePath)) return;
  const original = readFileSync(filePath, "utf8");
  const updated = original.split(from).join(to);
  if (updated !== original) writeFileSync(filePath, updated);
}

export function isValidAppName(name) {
  return /^[a-z][a-z0-9-]*$/.test(name);
}
