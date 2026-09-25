import type { Utterance } from "./types";

const QS = "model=nova-3&diarize=true&utterances=true&smart_format=true&punctuate=true&utt_split=0.9";

type DGUtterance = { start: number; end: number; speaker: number; transcript: string };
type DGResponse = { metadata?: { duration?: number }; results?: { utterances?: DGUtterance[] } };

async function call(body: BodyInit, contentType: string): Promise<DGResponse> {
  if (!process.env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not set");
  const res = await fetch(`https://api.deepgram.com/v1/listen?${QS}`, {
    method: "POST",
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": contentType },
    body,
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`);
  return res.json();
}

export const transcribeUrl = (url: string) => call(JSON.stringify({ url }), "application/json");
export const transcribeBytes = (bytes: Uint8Array, mime: string) => call(bytes as BodyInit, mime);

// Merge Deepgram's fine-grained utterances into speaker turns: same speaker, short gap, capped length,
// so a line is a readable thought but still short enough for tight playback highlighting.
export function toUtterances(dg: DGResponse): { utterances: Utterance[]; durationMs: number } {
  const raw = (dg.results?.utterances ?? []).filter((u) => u.transcript.trim());
  const merged: Utterance[] = [];
  for (const u of raw) {
    const prev = merged.at(-1);
    const startMs = Math.round(u.start * 1000);
    const endMs = Math.round(u.end * 1000);
    if (prev && prev.speaker === u.speaker && startMs - prev.endMs < 1500 && endMs - prev.startMs < 40000) {
      prev.text += " " + u.transcript.trim();
      prev.endMs = endMs;
    } else {
      merged.push({ idx: merged.length, speaker: u.speaker, startMs, endMs, text: u.transcript.trim() });
    }
  }
  const durationMs = Math.round((dg.metadata?.duration ?? 0) * 1000) || (merged.at(-1)?.endMs ?? 0);
  return { utterances: merged, durationMs };
}

export const SPEAKER_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#a855f7", "#ec4899", "#84cc16",
  "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4",
];

export function talkTime(utts: Utterance[]) {
  const t = new Map<number, number>();
  for (const u of utts) t.set(u.speaker, (t.get(u.speaker) ?? 0) + (u.endMs - u.startMs));
  return t;
}
