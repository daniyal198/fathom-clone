import { after } from "next/server";
import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { writeNotes } from "@/lib/pipeline";

export const maxDuration = 60;

// Ends a simulated live call: the "recording" is the replayed meeting up to the moment you hung up.
// Transcript and speakers are copied for that span; notes are generated fresh by the same AI pipeline.
export async function POST(req: Request, ctx: RouteContext<"/api/live/[eventId]/end">) {
  const { eventId } = await ctx.params;
  const { elapsedMs, highlights = [] } = (await req.json()) as {
    elapsedMs: number;
    highlights?: { startMs: number; endMs: number; note: string }[];
  };
  const [ev] = await sql`SELECT * FROM calendar_events WHERE id = ${eventId}`;
  if (!ev?.replay_of) return Response.json({ error: "This event can't be simulated" }, { status: 400 });
  const [src] = await sql`SELECT * FROM meetings WHERE id = ${ev.replay_of}`;
  const dur = Math.max(5000, Math.min(Math.round(elapsedMs), src.duration_ms));
  const id = `${eventId}-${nanoid(6)}`.toLowerCase();

  await sql`
    INSERT INTO meetings (id, title, source_title, started_at, duration_ms, media_url, source_url, source_label, recorded_on,
                          platform, meeting_type, default_template, status, status_detail)
    VALUES (${id}, ${ev.title}, ${src.source_title}, ${new Date(Date.now() - dur).toISOString()}, ${dur}, ${src.media_url},
            ${src.source_url}, ${src.source_label}, ${src.recorded_on}, ${ev.platform}, ${src.meeting_type}, ${src.default_template},
            'processing', 'Writing notes & action items')`;
  await sql`
    INSERT INTO utterances (meeting_id, idx, speaker, start_ms, end_ms, text)
    SELECT ${id}, idx, speaker, start_ms, LEAST(end_ms, ${dur}), text FROM utterances
    WHERE meeting_id = ${src.id} AND start_ms < ${dur}`;
  await sql`
    INSERT INTO participants (meeting_id, key, name, role, color, talk_ms)
    SELECT ${id}, p.key, p.name, p.role, p.color, COALESCE(SUM(u.end_ms - u.start_ms), 0)::int
    FROM participants p JOIN utterances u ON u.meeting_id = ${id} AND u.speaker = p.key
    WHERE p.meeting_id = ${src.id}
    GROUP BY p.key, p.name, p.role, p.color`;
  for (const h of highlights.slice(0, 50)) {
    await sql`INSERT INTO highlights (id, meeting_id, start_ms, end_ms, note, source)
              VALUES (${nanoid(10)}, ${id}, ${Math.max(0, Math.round(h.startMs))}, ${Math.min(dur, Math.round(h.endMs))}, ${String(h.note ?? "").slice(0, 500)}, 'live')`;
  }
  await sql`UPDATE calendar_events SET meeting_id = ${id} WHERE id = ${eventId}`;

  after(async () => {
    try {
      await writeNotes(id);
    } catch (e) {
      console.error("live notes failed", e);
      await sql`UPDATE meetings SET status = 'failed', status_detail = 'Could not write notes. The AI service is busy; try again.' WHERE id = ${id}`;
    }
  });
  return Response.json({ id });
}
