// Seed pipeline, stage 2: media -> diarized transcript -> named speakers -> AI notes.
// Every stage caches its output in data/seed/ (committed), so reruns only do missing work.
//   npx tsx scripts/seed/process.ts [id...]
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { toUtterances } from "../../src/lib/deepgram";
import { generateInsights, generateSummary, nameSpeakers } from "../../src/lib/ai/notes";
import type { Participant, Utterance } from "../../src/lib/types";

config({ path: ".env.local" });

const ROOT = path.resolve(__dirname, "../..");
const SEED = path.join(ROOT, "data/seed");
const MEDIA = path.join(ROOT, "data/media");
const sources: { id: string; youtube: string; template: string }[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "sources.json"), "utf8")
);

const readJSON = <T>(f: string): T | null => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const writeJSON = (f: string, d: unknown) => fs.writeFileSync(f, JSON.stringify(d, null, 1));

type Transcript = { durationMs: number; utterances: Utterance[] };
type Speakers = { key: number; name: string; role: string | null; confident: boolean }[];

// Diarization noise: a "speaker" with a few seconds of audio is almost always a mis-split of a neighbour.
function absorbTinySpeakers(utts: Utterance[]) {
  const total = new Map<number, number>();
  for (const u of utts) total.set(u.speaker, (total.get(u.speaker) ?? 0) + u.endMs - u.startMs);
  const tiny = new Set([...total].filter(([, ms]) => ms < 4000).map(([k]) => k));
  return utts.map((u, i) => {
    if (!tiny.has(u.speaker)) return u;
    const neighbour = utts.slice(0, i).reverse().find((p) => !tiny.has(p.speaker)) ?? utts.find((p) => !tiny.has(p.speaker));
    return { ...u, speaker: neighbour?.speaker ?? u.speaker };
  });
}

async function processOne(src: (typeof sources)[number]) {
  const info = readJSON<Record<string, unknown>>(path.join(SEED, `${src.id}.info.json`));
  if (!info) return console.log(`skip ${src.id}: no info.json (run fetch.sh first)`);

  // 1. Transcript
  const tFile = path.join(SEED, `${src.id}.transcript.json`);
  let transcript = readJSON<Transcript>(tFile);
  if (!transcript) {
    console.log(`[${src.id}] transcribing…`);
    // curl, not fetch: Node's fetch resets the connection on large (~20MB) uploads to Deepgram.
    const out = execFileSync("curl", [
      "-sS", "--fail-with-body", "-X", "POST",
      "https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&smart_format=true&punctuate=true&utt_split=0.9",
      "-H", `Authorization: Token ${process.env.DEEPGRAM_API_KEY}`, "-H", "Content-Type: audio/mpeg",
      "--data-binary", `@${path.join(MEDIA, `${src.id}.mp3`)}`,
    ], { maxBuffer: 256 * 1024 * 1024 });
    const { utterances, durationMs } = toUtterances(JSON.parse(out.toString()));
    transcript = { durationMs, utterances: absorbTinySpeakers(utterances) };
    writeJSON(tFile, transcript);
  }

  // 2. Speaker names
  const sFile = path.join(SEED, `${src.id}.speakers.json`);
  let speakers = readJSON<Speakers>(sFile);
  if (!speakers) {
    console.log(`[${src.id}] naming speakers…`);
    const keys = [...new Set(transcript.utterances.map((u) => u.speaker))].sort((a, b) => a - b);
    const context = `Video title: ${info.title}
Channel: ${info.channel}
Recorded: ${info.upload_date}
Description:
${String(info.description ?? "").slice(0, 3000)}`;
    speakers = await nameSpeakers(context, transcript.utterances, keys);
    writeJSON(sFile, speakers);
  }

  // 3. Notes: title, action items, chapters, default + template summaries
  const nFile = path.join(SEED, `${src.id}.notes.json`);
  const notes = readJSON<Record<string, any>>(nFile) ?? { summaries: {} };
  const people: Participant[] = speakers.map((s) => ({ key: s.key, name: s.name, role: s.role, color: "", talkMs: 0 }));
  const utts = transcript.utterances;
  const title = String(info.title);
  if (!notes.chapters) {
    console.log(`[${src.id}] insights…`);
    Object.assign(notes, await generateInsights(title, utts, people));
    writeJSON(nFile, notes);
  }
  for (const key of new Set(["general", src.template])) {
    if (notes.summaries[key]) continue;
    console.log(`[${src.id}] summary: ${key}…`);
    notes.summaries[key] = await generateSummary(key, title, utts, people);
    writeJSON(nFile, notes);
  }
  console.log(`[${src.id}] done: ${utts.length} lines, ${speakers.length} speakers, ${notes.actionItems.length} action items`);
}

async function main() {
 const only = process.argv.slice(2);
 for (const src of sources) {
  if (only.length && !only.includes(src.id)) continue;
  if (!fs.existsSync(path.join(MEDIA, `${src.id}.mp3`)) && !fs.existsSync(path.join(SEED, `${src.id}.transcript.json`))) {
    console.log(`skip ${src.id}: media not downloaded yet`);
    continue;
  }
  try {
    await processOne(src);
  } catch (e) {
    console.error(`[${src.id}] FAILED`, e);
  }
}
}

main();
