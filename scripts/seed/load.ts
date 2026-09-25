// Seed pipeline, stage 3: upload media to Vercel Blob and load everything into Postgres.
// Idempotent: each seeded meeting is deleted (cascade) and re-inserted.
//   npx tsx scripts/seed/load.ts [--calendar-only]
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import type { Participant, Utterance } from "../../src/lib/types";

config({ path: ".env.local" });

const ROOT = path.resolve(__dirname, "../..");
const SEED = path.join(ROOT, "data/seed");
const MEDIA = path.join(ROOT, "data/media");
const URLS = path.join(SEED, "media-urls.json");

type Source = {
  id: string;
  youtube: string;
  type: string;
  template: string;
  title?: string;
  daysAgo: number;
  hour: number;
  shared?: boolean;
  platform?: string;
};

const readJSON = <T>(f: string): T => JSON.parse(fs.readFileSync(f, "utf8"));

async function main() {
  const { sql } = await import("../../src/lib/db");
  const { put } = await import("@vercel/blob");
  const { SPEAKER_COLORS, talkTime } = await import("../../src/lib/deepgram");
  const sources = readJSON<Source[]>(path.join(__dirname, "sources.json"));
  const urls: Record<string, string> = fs.existsSync(URLS) ? readJSON(URLS) : {};

  // --calendar-only: refresh the demo calendar without touching meetings (keeps highlights, ticks, generated notes).
  const calendarOnly = process.argv.includes("--calendar-only");
  for (const src of calendarOnly ? [] : sources) {
    const nFile = path.join(SEED, `${src.id}.notes.json`);
    if (!fs.existsSync(nFile)) {
      console.log(`skip ${src.id}: not processed`);
      continue;
    }
    const info = readJSON<Record<string, any>>(path.join(SEED, `${src.id}.info.json`));
    const transcript = readJSON<{ durationMs: number; utterances: Utterance[] }>(path.join(SEED, `${src.id}.transcript.json`));
    const speakers = readJSON<{ key: number; name: string; role: string | null }[]>(path.join(SEED, `${src.id}.speakers.json`));
    const notes = readJSON<Record<string, any>>(nFile);

    // Media: upload once, remember the URL (committed) so later loads skip the upload.
    if (!urls[src.id]) {
      const file = path.join(MEDIA, `${src.id}.mp4`);
      if (!fs.existsSync(file)) {
        console.log(`skip ${src.id}: no media file`);
        continue;
      }
      console.log(`[${src.id}] uploading ${(fs.statSync(file).size / 1e6).toFixed(0)} MB…`);
      const blob = await put(`meetings/${src.id}.mp4`, fs.readFileSync(file), {
        access: "public",
        contentType: "video/mp4",
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: true,
      });
      urls[src.id] = blob.url;
      fs.writeFileSync(URLS, JSON.stringify(urls, null, 1));
    }

    // Participants: merge diarized speakers that resolved to the same name, colour by talk time.
    const utts = transcript.utterances;
    const nameOf = new Map(speakers.map((s) => [s.key, s.name]));
    const canonical = new Map<string, number>();
    for (const s of speakers) if (!canonical.has(s.name)) canonical.set(s.name, s.key);
    const remapped = utts.map((u) => ({ ...u, speaker: canonical.get(nameOf.get(u.speaker) ?? "") ?? u.speaker }));
    const talk = talkTime(remapped);
    const people: Participant[] = [...canonical.entries()]
      .map(([name, key]) => ({
        key,
        name,
        role: speakers.find((s) => s.key === key)?.role ?? null,
        color: "",
        talkMs: talk.get(key) ?? 0,
      }))
      .filter((p) => p.talkMs > 0)
      .sort((a, b) => b.talkMs - a.talkMs)
      .map((p, i) => ({ ...p, color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }));

    const started = new Date();
    started.setDate(started.getDate() - src.daysAgo);
    started.setHours(src.hour, src.daysAgo === 0 ? 0 : 30 * (src.hour % 2), 0, 0);

    const title = src.title ?? String(notes.title ?? info.title);
    const recordedOn = info.upload_date ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}` : null;

    await sql`DELETE FROM meetings WHERE id = ${src.id}`;
    await sql`
      INSERT INTO meetings (id, title, source_title, started_at, duration_ms, media_url, source_url, source_label, recorded_on,
                            platform, meeting_type, default_template, status, shared_with_me)
      VALUES (${src.id}, ${title}, ${info.title}, ${started.toISOString()}, ${transcript.durationMs}, ${urls[src.id]},
              ${`https://www.youtube.com/watch?v=${src.youtube}`}, ${`${info.channel} on YouTube`}, ${recordedOn},
              ${src.platform ?? "zoom"}, ${src.type}, ${src.template}, 'ready', ${src.shared ?? false})`;
    await sql.query(
      `INSERT INTO participants (meeting_id, key, name, role, color, talk_ms)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::int[])`,
      [src.id, people.map((p) => p.key), people.map((p) => p.name), people.map((p) => p.role), people.map((p) => p.color), people.map((p) => p.talkMs)]
    );
    await sql.query(
      `INSERT INTO utterances (meeting_id, idx, speaker, start_ms, end_ms, text)
       SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[], $5::int[], $6::text[])`,
      [src.id, remapped.map((u) => u.idx), remapped.map((u) => u.speaker), remapped.map((u) => u.startMs), remapped.map((u) => u.endMs), remapped.map((u) => u.text)]
    );
    const ch = notes.chapters as { idx: number; title: string; gist: string; startMs: number; endMs: number }[];
    await sql.query(
      `INSERT INTO chapters (meeting_id, idx, title, gist, start_ms, end_ms)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::int[], $6::int[])`,
      [src.id, ch.map((c) => c.idx), ch.map((c) => c.title), ch.map((c) => c.gist), ch.map((c) => c.startMs), ch.map((c) => c.endMs)]
    );
    for (const [key, s] of Object.entries(notes.summaries as Record<string, { content: unknown; model: string }>)) {
      await sql`INSERT INTO summaries (meeting_id, template_key, content, model) VALUES (${src.id}, ${key}, ${JSON.stringify(s.content)}::jsonb, ${s.model})`;
    }
    const ai = notes.actionItems as { text: string; assignee: string | null; startMs: number | null }[];
    // A couple of items start out ticked off so the list looks lived-in.
    await sql.query(
      `INSERT INTO action_items (meeting_id, text, assignee, start_ms, done)
       SELECT $1, * FROM unnest($2::text[], $3::text[], $4::int[], $5::bool[])`,
      [src.id, ai.map((a) => a.text), ai.map((a) => a.assignee), ai.map((a) => a.startMs), ai.map((_, i) => src.daysAgo > 3 && i % 3 === 0)]
    );

    // Seeded highlights: the moments behind the first two key takeaways.
    const takeaways = (notes.summaries.general?.content?.sections?.[0]?.bullets ?? []) as { text: string; startMs: number | null }[];
    let n = 0;
    for (const b of takeaways.filter((b) => b.startMs != null).slice(0, 2)) {
      const id = `${src.id}-h${n++}`;
      const share = src.id === "pmm-weekly" && n === 1 ? "pmm-sales-play-clip" : null;
      await sql`INSERT INTO highlights (id, meeting_id, start_ms, end_ms, note, source, share_token, created_at)
                VALUES (${id}, ${src.id}, ${Math.max(0, b.startMs! - 3000)}, ${b.startMs! + 27000}, ${b.text}, 'manual', ${share},
                        ${new Date(started.getTime() + b.startMs!).toISOString()})`;
    }
    console.log(`[${src.id}] loaded: ${people.length} people, ${remapped.length} lines, ${ai.length} action items`);
  }

  // Upcoming calendar (stubbed Google Calendar). Recordable events replay a real recording in the live simulator.
  await sql`DELETE FROM calendar_events`;
  const loaded = new Set((await sql`SELECT id FROM meetings`).map((r) => r.id as string));
  // Offsets are minutes from the top of the current hour, resolved at read time (see getCalendar).
  type Ev = { id: string; title: string; off: number; len: number; who: string[]; ext: boolean; rec: boolean; replay: string | null; platform?: string };
  const events: Ev[] = [
    { id: "ev-pmm", title: "Product marketing weekly", off: 0, len: 60, who: [], ext: false, rec: true, replay: "pmm-weekly" },
    { id: "ev-package", title: "Package team weekly", off: 90, len: 15, who: [], ext: false, rec: true, replay: "package-weekly" },
    { id: "ev-focus", title: "Focus time", off: 120, len: 90, who: [], ext: false, rec: false, replay: null, platform: "none" },
    { id: "ev-discovery", title: "Discovery call: Northwind Foods", off: 240, len: 30, who: [], ext: true, rec: true, replay: "steak-discovery" },
    { id: "ev-sig", title: "SIG Network community call", off: 1440 + 60, len: 30, who: [], ext: true, rec: false, replay: "k8s-sig-network" },
    { id: "ev-ceo", title: "Pods & CEO sync", off: 1440 + 180, len: 30, who: [], ext: false, rec: true, replay: "ceo-pods-sync", platform: "meet" },
    { id: "ev-interview", title: "Interview: Senior PMM candidate", off: 2880 + 120, len: 45, who: ["Jordan Lee (candidate)", "Cindy"], ext: true, rec: false, replay: null, platform: "teams" },
  ];
  const names = new Map<string, string[]>();
  for (const r of await sql`SELECT meeting_id, array_agg(name ORDER BY talk_ms DESC) AS names FROM participants GROUP BY meeting_id`) {
    names.set(r.meeting_id as string, r.names as string[]);
  }
  for (const ev of events) {
    if (ev.replay && names.has(ev.replay)) ev.who = names.get(ev.replay)!;
    await sql`INSERT INTO calendar_events (id, title, starts_at, ends_at, offset_min, length_min, attendees, platform, external, record, replay_of)
              VALUES (${ev.id}, ${ev.title}, now(), now(), ${ev.off}, ${ev.len}, ${JSON.stringify(ev.who)}::jsonb, ${ev.platform ?? "zoom"},
                      ${ev.ext}, ${ev.rec}, ${ev.replay && loaded.has(ev.replay) ? ev.replay : null})`;
  }
  await sql`UPDATE settings SET calendar_connected = false, calendar_email = null, auto_record = 'all' WHERE id = 1`;
  console.log(`calendar: ${events.length} events`);
}

main();
