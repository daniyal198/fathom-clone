import "server-only";
import { sql } from "./db";
import { SPEAKER_COLORS, talkTime, toUtterances, transcribeUrl } from "./deepgram";
import { generateInsights, generateSummary, nameSpeakers } from "./ai/notes";
import type { Participant, Utterance } from "./types";

const setStatus = (id: string, status: string, detail: string | null) =>
  sql`UPDATE meetings SET status = ${status}, status_detail = ${detail} WHERE id = ${id}`;

/** Post-call AI: chapters, action items and notes for a meeting whose transcript is already stored. */
export async function writeNotes(id: string) {
  await setStatus(id, "processing", "Writing notes & action items");
  const [m] = await sql`SELECT title, default_template FROM meetings WHERE id = ${id}`;
  const [people, rows] = await Promise.all([
    sql`SELECT key, name, role, color, talk_ms AS "talkMs" FROM participants WHERE meeting_id = ${id}`,
    sql`SELECT idx, speaker, start_ms AS "startMs", end_ms AS "endMs", text FROM utterances WHERE meeting_id = ${id} ORDER BY idx`,
  ]);
  const utts = rows as Utterance[];
  const ppl = people as Participant[];
  if (!utts.length) {
    await setStatus(id, "failed", "No speech was detected in this recording.");
    return;
  }
  const [insights, general] = await Promise.all([
    generateInsights(m.title, utts, ppl),
    generateSummary("general", m.title, utts, ppl),
  ]);
  const ch = insights.chapters;
  await sql.query(
    `INSERT INTO chapters (meeting_id, idx, title, gist, start_ms, end_ms)
     SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::int[], $6::int[])`,
    [id, ch.map((c) => c.idx), ch.map((c) => c.title), ch.map((c) => c.gist), ch.map((c) => c.startMs), ch.map((c) => c.endMs)]
  );
  const ai = insights.actionItems;
  await sql.query(
    `INSERT INTO action_items (meeting_id, text, assignee, start_ms)
     SELECT $1, * FROM unnest($2::text[], $3::text[], $4::int[])`,
    [id, ai.map((a) => a.text), ai.map((a) => a.assignee), ai.map((a) => a.startMs)]
  );
  await sql`INSERT INTO summaries (meeting_id, template_key, content, model)
            VALUES (${id}, 'general', ${JSON.stringify(general.content)}::jsonb, ${general.model})
            ON CONFLICT (meeting_id, template_key) DO NOTHING`;
  if (m.default_template !== "general") {
    const extra = await generateSummary(m.default_template, m.title, utts, ppl).catch(() => null);
    if (extra) {
      await sql`INSERT INTO summaries (meeting_id, template_key, content, model)
                VALUES (${id}, ${m.default_template}, ${JSON.stringify(extra.content)}::jsonb, ${extra.model})
                ON CONFLICT (meeting_id, template_key) DO NOTHING`;
    }
  }
  await setStatus(id, "ready", null);
}

/** Uploaded recording: Deepgram (diarized) -> speaker names -> notes. */
export async function ingestUpload(id: string, mediaUrl: string) {
  try {
    await setStatus(id, "processing", "Transcribing & identifying speakers");
    const { utterances, durationMs } = toUtterances(await transcribeUrl(mediaUrl));
    const [m] = await sql`SELECT title FROM meetings WHERE id = ${id}`;
    const keys = [...new Set(utterances.map((u) => u.speaker))].sort((a, b) => a - b);
    const named = utterances.length
      ? await nameSpeakers(`Meeting title: ${m.title}`, utterances, keys).catch(() => [])
      : [];
    const talk = talkTime(utterances);
    const people = keys
      .map((k) => ({ key: k, name: named.find((n) => n.key === k)?.name ?? `Speaker ${k + 1}`, role: named.find((n) => n.key === k)?.role ?? null, talkMs: talk.get(k) ?? 0 }))
      .sort((a, b) => b.talkMs - a.talkMs)
      .map((p, i) => ({ ...p, color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }));
    await sql`UPDATE meetings SET duration_ms = ${durationMs} WHERE id = ${id}`;
    if (people.length) {
      await sql.query(
        `INSERT INTO participants (meeting_id, key, name, role, color, talk_ms)
         SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::int[])`,
        [id, people.map((p) => p.key), people.map((p) => p.name), people.map((p) => p.role), people.map((p) => p.color), people.map((p) => p.talkMs)]
      );
      await sql.query(
        `INSERT INTO utterances (meeting_id, idx, speaker, start_ms, end_ms, text)
         SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::int[], $6::text[])`,
        [id, utterances.map((u) => u.idx), utterances.map((u) => u.speaker), utterances.map((u) => u.startMs), utterances.map((u) => u.endMs), utterances.map((u) => u.text)]
      );
    }
    await writeNotes(id);
  } catch (e) {
    console.error("ingest failed", id, e);
    await setStatus(id, "failed", String((e as Error).message ?? e).slice(0, 300));
  }
}
