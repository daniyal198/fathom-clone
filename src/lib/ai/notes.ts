import { generateJSON } from "./gemini";
import { templateByKey } from "./templates";
import type { Chapter, Participant, SummaryContent, Utterance } from "../types";

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// The model cites transcript lines by number (#idx); we map those back to exact timestamps.
export function formatTranscript(utts: Utterance[], people: Pick<Participant, "key" | "name">[]) {
  const name = new Map(people.map((p) => [p.key, p.name]));
  return utts.map((u) => `#${u.idx} [${clock(u.startMs)}] ${name.get(u.speaker) ?? `Speaker ${u.speaker + 1}`}: ${u.text}`).join("\n");
}

const lineToMs = (utts: Utterance[]) => {
  const m = new Map(utts.map((u) => [u.idx, u.startMs]));
  return (line: number | null | undefined) => (line == null ? null : (m.get(line) ?? null));
};

const SYSTEM = `You are the note-taker for a recorded meeting. You write crisp, specific notes that a busy person can scan in 20 seconds.
Rules:
- Be concrete: names, numbers, products, dates. Never generic filler like "the team discussed various topics".
- Every bullet cites the transcript line (#number) where it is best supported, in the "line" field only. Never write line numbers or timestamps inside "text".
- Only state what is in the transcript. If something is unclear, say so briefly.
- Refer to people by name as given in the transcript.`;

// Belt and braces: strip "(line 12)" / "(#12, #14)" style citations the model sometimes leaves in text.
const clean = (t: string) => t.replace(/\s*\((?:lines?|#)\s*[#\d][^)]*\)/gi, "").trim();

const bulletSchema = {
  type: "object",
  properties: { text: { type: "string" }, line: { type: ["integer", "null"] } },
  required: ["text", "line"],
};

type RawSummary = { tldr: string; sections: { heading: string; bullets: { text: string; line: number | null }[] }[] };

export async function generateSummary(templateKey: string, title: string, utts: Utterance[], people: Participant[]) {
  const t = templateByKey(templateKey);
  const { data, model } = await generateJSON<RawSummary>({
    system: SYSTEM,
    prompt: `Meeting: "${title}"
Participants: ${people.map((p) => p.name).join(", ")}

Write meeting notes using the "${t.name}" template.
${t.guidance}
Also write "tldr": 1-2 sentences on what this meeting was and its most important outcome.
Bullets are one sentence each, max ~25 words.

TRANSCRIPT
${formatTranscript(utts, people)}`,
    schema: {
      type: "object",
      properties: {
        tldr: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: { heading: { type: "string" }, bullets: { type: "array", items: bulletSchema } },
            required: ["heading", "bullets"],
          },
        },
      },
      required: ["tldr", "sections"],
    },
  });
  const toMs = lineToMs(utts);
  const content: SummaryContent = {
    tldr: clean(data.tldr),
    sections: data.sections
      .filter((s) => s.bullets.length)
      .map((s) => ({ heading: s.heading, bullets: s.bullets.map((b) => ({ text: clean(b.text), startMs: toMs(b.line) })) })),
  };
  return { content, model };
}

type RawInsights = {
  title: string;
  actionItems: { text: string; assignee: string | null; line: number | null }[];
  chapters: { title: string; line: number; gist: string }[];
};

export async function generateInsights(title: string, utts: Utterance[], people: Participant[]) {
  const durationMs = utts.at(-1)?.endMs ?? 0;
  const targetChapters = Math.max(3, Math.min(12, Math.round(durationMs / 1000 / 60 / 5)));
  const { data, model } = await generateJSON<RawInsights>({
    system: SYSTEM,
    prompt: `Meeting: "${title}"
Participants: ${people.map((p) => p.name).join(", ")}

1. "title": a short, specific meeting title (max 6 words) as it would appear in a calendar, e.g. "Q3 launch plan review".
2. "actionItems": every concrete commitment or follow-up someone took on or was asked to do. "text" starts with a verb. "assignee" is the person's name exactly as listed in Participants, or null if nobody owns it. "line" is where it was said. Do not invent items; an empty list is fine.
3. "chapters": about ${targetChapters} chapters that split the whole meeting into its topics, in order. "line" is the first line of the chapter (the first chapter starts at line #0). "title" max 6 words. "gist" is one sentence.

TRANSCRIPT
${formatTranscript(utts, people)}`,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: { text: { type: "string" }, assignee: { type: ["string", "null"] }, line: { type: ["integer", "null"] } },
            required: ["text", "assignee", "line"],
          },
        },
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, line: { type: "integer" }, gist: { type: "string" } },
            required: ["title", "line", "gist"],
          },
        },
      },
      required: ["title", "actionItems", "chapters"],
    },
  });
  const toMs = lineToMs(utts);
  const names = new Set(people.map((p) => p.name));
  const actionItems = data.actionItems.map((a) => ({
    text: clean(a.text),
    assignee: a.assignee && names.has(a.assignee) ? a.assignee : null,
    startMs: toMs(a.line),
  }));
  const starts = data.chapters
    .map((c) => ({ ...c, startMs: toMs(c.line) ?? 0 }))
    .sort((a, b) => a.startMs - b.startMs);
  if (starts.length) starts[0].startMs = 0;
  const chapters: Chapter[] = starts.map((c, i) => ({
    idx: i,
    title: clean(c.title),
    gist: clean(c.gist),
    startMs: c.startMs,
    endMs: starts[i + 1]?.startMs ?? durationMs,
  }));
  return { title: data.title, actionItems, chapters, model };
}

// Diarization gives "Speaker 0..n"; recover real names from intros, direct address and the video description.
export async function nameSpeakers(context: string, utts: Utterance[], speakerKeys: number[]) {
  const sample = utts.slice(0, 400);
  const { data } = await generateJSON<{ speakers: { key: number; name: string; role: string | null; confident: boolean }[] }>({
    system:
      "You identify who is who in a diarized meeting transcript. Use self-introductions, people addressing each other by name, hand-offs (\"over to you, Sam\"), and the provided context. Never guess wildly.",
    prompt: `${context}

Speakers to identify: ${speakerKeys.map((k) => `Speaker ${k}`).join(", ")}
For each, give "name" (first and last name if known, otherwise first name; if truly unknown use a short descriptive label like "Guest 1"), "role" (e.g. "Product Marketing Manager", or null), and "confident".

TRANSCRIPT (speaker labels are diarization ids)
${sample.map((u) => `[Speaker ${u.speaker}] ${u.text}`).join("\n")}`,
    schema: {
      type: "object",
      properties: {
        speakers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "integer" },
              name: { type: "string" },
              role: { type: ["string", "null"] },
              confident: { type: "boolean" },
            },
            required: ["key", "name", "role", "confident"],
          },
        },
      },
      required: ["speakers"],
    },
  });
  return data.speakers;
}
