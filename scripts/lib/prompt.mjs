/**
 * Terminal prompt helpers for `scripts/setup.mjs`.
 *
 * A SINGLE long-lived readline interface for the whole script. Creating a new
 * interface per prompt breaks under piped/non-interactive stdin: once the first
 * reader hits EOF, later interfaces emit neither `line` nor `close`, their
 * promise hangs, and node exits silently when the event loop drains. With one
 * shared reader we queue every line and hand them out one prompt at a time, and
 * resolve "" after EOF so the script can never hang.
 */

import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const lineQueue = [];
let pendingResolver = null;
let stdinEnded = false;

// When `muted`, suppress echoed keystrokes (for the private key) while still
// letting the prompt itself and the trailing newline through, so the terminal
// doesn't garble. Echo is only emitted on a real TTY (terminal mode); under a
// pipe there's nothing to mute.
let muted = false;
const originalWriteToOutput = rl._writeToOutput.bind(rl);
rl._writeToOutput = (str) => {
  if (muted && str !== "\n" && str !== "\r\n") return;
  originalWriteToOutput(str);
};

rl.on("line", (line) => {
  if (pendingResolver) {
    const resolve = pendingResolver;
    pendingResolver = null;
    resolve(line);
  } else {
    lineQueue.push(line);
  }
});
rl.on("close", () => {
  stdinEnded = true;
  if (pendingResolver) {
    const resolve = pendingResolver;
    pendingResolver = null;
    resolve("");
  }
});

function nextLine() {
  if (lineQueue.length) return Promise.resolve(lineQueue.shift());
  if (stdinEnded) return Promise.resolve("");
  return new Promise((resolve) => {
    pendingResolver = resolve;
  });
}

// Questions get a blank line and a cyan "?" marker so they stand out from the
// surrounding progress output. Colour is only used on a real terminal.
const QUESTION_MARKER = process.stdout.isTTY ? "\x1b[36m?\x1b[0m " : "? ";

// `followUp` skips the blank line and marker, for an answer line that sits
// directly under a question that's already been printed (see askChoice).
export async function ask(query, { mask = false, followUp = false } = {}) {
  process.stdout.write(followUp ? `  ${query}` : `\n${QUESTION_MARKER}${query}`);
  muted = mask;
  const line = await nextLine();
  if (muted) {
    muted = false;
    process.stdout.write("\n"); // we suppressed the user's Enter echo
  }
  return line.trim();
}

export async function askWithDefault(label, current, { mask = false } = {}) {
  const shown = current ? (mask ? "•".repeat(8) : current) : "";
  const suffix = current ? ` (enter to keep ${shown})` : "";
  const answer = await ask(`${label}${suffix}: `, { mask });
  return answer || current || "";
}

export async function askYesNo(query, defaultNo = true) {
  const answer = (await ask(`${query} ${defaultNo ? "(y/N)" : "(Y/n)"}: `))
    .toLowerCase();
  if (!answer) return !defaultNo;
  return answer === "y" || answer === "yes";
}

// Numbered pick list; Enter selects the first option.
export async function askChoice(label, options) {
  console.log(`\n${QUESTION_MARKER}${label}`);
  options.forEach((option, i) => console.log(`  ${i + 1}) ${option}`));
  while (true) {
    const answer = await ask(`Choice (1-${options.length}, enter for 1): `, { followUp: true });
    if (!answer) return 0;
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && index >= 0 && index < options.length) return index;
    console.log("  Enter one of the numbers above.");
  }
}

export function closePrompt() {
  rl.close();
}
