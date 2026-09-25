#!/usr/bin/env node
// 8x agent capture hook for Claude Code.
//   UserPromptSubmit -> `node scripts/capture.mjs prompt`  (appends the verbatim prompt)
//   Stop             -> `node scripts/capture.mjs stop`    (appends the turn's final response)
// Writes one file per session: .agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md
// Never blocks the agent: every failure is swallowed and the process exits 0.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const AUTHOR = "daniyal198";
const TOOL = "claude-code";

const mode = process.argv[2];

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readTranscript(p) {
  if (!p || !fs.existsSync(p)) return [];
  const out = [];
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {}
  }
  return out;
}

// A real user prompt, as opposed to a tool_result or injected meta entry.
function isRealPrompt(e) {
  if (e.type !== "user" || e.isSidechain || e.isMeta) return false;
  const c = e.message?.content;
  if (typeof c === "string") return true;
  return Array.isArray(c) && c.some((b) => b.type === "text");
}

function lastModel(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type === "assistant" && !e.isSidechain && e.message?.model && e.message.model !== "<synthetic>") {
      return e.message.model;
    }
  }
  return null;
}

// The final response of the latest turn: the text blocks after the turn's last tool call.
// If the turn ended on a question to the user (AskUserQuestion), render that question,
// because that is what the user actually got back.
function finalResponse(entries) {
  let start = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isRealPrompt(entries[i])) {
      start = i + 1;
      break;
    }
  }
  const blocks = [];
  for (const e of entries.slice(start)) {
    if (e.type !== "assistant" || e.isSidechain) continue;
    for (const b of e.message?.content ?? []) blocks.push({ b, e });
  }
  let lastTool = -1;
  blocks.forEach(({ b }, i) => {
    if (b.type === "tool_use") lastTool = i;
  });
  const trailing = blocks.slice(lastTool + 1).filter(({ b }) => b.type === "text" && b.text?.trim());
  if (trailing.length) {
    return { text: trailing.map(({ b }) => b.text).join("\n\n"), entry: trailing.at(-1).e };
  }
  const last = lastTool >= 0 ? blocks[lastTool] : null;
  if (last && last.b.name === "AskUserQuestion") {
    const texts = blocks.slice(0, lastTool).filter(({ b }) => b.type === "text" && b.text?.trim());
    const lead = texts.length ? texts.at(-1).b.text + "\n\n" : "";
    const qs = (last.b.input?.questions ?? [])
      .map((q) => `[Question] ${q.question}\n` + (q.options ?? []).map((o) => `- ${o.label}: ${o.description}`).join("\n"))
      .join("\n\n");
    return { text: lead + qs, entry: last.e };
  }
  const texts = blocks.filter(({ b }) => b.type === "text" && b.text?.trim());
  if (texts.length) return { text: texts.at(-1).b.text, entry: texts.at(-1).e };
  return null;
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}`;
}

function logFile(dir, sid, project, model, now) {
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).find((f) => f.endsWith(`_${sid}.md`));
  if (existing) return path.join(dir, existing);
  const file = path.join(dir, `${stamp(now)}_${sid}.md`);
  const iso = now.toISOString();
  const date = iso.slice(0, 10);
  fs.writeFileSync(
    file,
    `---
session_id: ${sid}
date: ${date}
author: ${AUTHOR}
model: ${model}
tool: ${TOOL}
project: ${project}
total_exchanges: 0
first_prompt_time: ${iso}
last_prompt_time: ${iso}
---

# Session Log - ${date}

Session: \`${sid.slice(0, 8)}\` | Project: \`${project}\` | Author: \`${AUTHOR}\`

---
`
  );
  return file;
}

function setField(doc, key, value) {
  return doc.replace(new RegExp(`^${key}: .*$`, "m"), `${key}: ${value}`);
}

function main() {
  const input = JSON.parse(readStdin() || "{}");
  const sid = input.session_id;
  if (!sid || (mode !== "prompt" && mode !== "stop")) return;

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const project = path.basename(root);
  const dir = path.join(root, ".agent-logs");
  const short = sid.slice(0, 8);
  const now = new Date();
  let entries = readTranscript(input.transcript_path);

  if (mode === "prompt") {
    const model = lastModel(entries) || input.model?.id || input.model || "unknown";
    const file = logFile(dir, sid, project, model, now);
    let doc = fs.readFileSync(file, "utf8");
    const num = (doc.match(/^\[LOG_ENTRY type=PROMPT /gm) || []).length + 1;
    const iso = now.toISOString();
    if (num === 1) doc = setField(doc, "first_prompt_time", iso);
    doc = setField(doc, "total_exchanges", num);
    doc = setField(doc, "last_prompt_time", iso);
    doc += `\n[LOG_ENTRY type=PROMPT num=${num} session=${short}]\ntimestamp: ${iso}\nmodel: ${model}\n\n${input.prompt ?? ""}\n\n`;
    fs.writeFileSync(file, doc);
    return;
  }

  // stop: the transcript can lag the hook by a moment, so retry briefly.
  let resp = finalResponse(entries);
  for (let i = 0; !resp && i < 10; i++) {
    sleep(200);
    entries = readTranscript(input.transcript_path);
    resp = finalResponse(entries);
  }
  const text = resp?.text ?? input.last_assistant_message ?? "";
  const model = resp?.entry?.message?.model || lastModel(entries) || "unknown";
  const file = logFile(dir, sid, project, model, now);
  let doc = fs.readFileSync(file, "utf8");
  const num = (doc.match(/^\[LOG_ENTRY type=PROMPT /gm) || []).length;
  if (num === 0) return;
  if (doc.includes(`[LOG_ENTRY type=RESPONSE num=${num} session=${short}]`)) return;
  const ts = resp?.entry?.timestamp || now.toISOString();
  doc = setField(doc, "model", model);
  doc += `\n[LOG_ENTRY type=RESPONSE num=${num} session=${short}]\ntimestamp: ${ts}\nmodel: ${model}\n\n${text}\n\n`;
  fs.writeFileSync(file, doc);
}

try {
  main();
} catch (err) {
  try {
    fs.appendFileSync(path.join(os.tmpdir(), "8x-capture-errors.log"), `${new Date().toISOString()} ${mode} ${err?.stack}\n`);
  } catch {}
}
process.exit(0);
