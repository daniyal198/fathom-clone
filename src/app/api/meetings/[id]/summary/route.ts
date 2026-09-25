import { sql } from "@/lib/db";
import { generateSummary } from "@/lib/ai/notes";
import { TEMPLATES } from "@/lib/ai/templates";
import type { Participant, Utterance } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/meetings/[id]/summary">) {
  const { id } = await ctx.params;
  const { template, force } = (await req.json()) as { template: string; force?: boolean };
  if (!TEMPLATES.some((t) => t.key === template)) return Response.json({ error: "Unknown template" }, { status: 400 });

  if (!force) {
    const [cached] = await sql`SELECT content FROM summaries WHERE meeting_id = ${id} AND template_key = ${template}`;
    if (cached) return Response.json(cached.content);
  }
  const [m] = await sql`SELECT title FROM meetings WHERE id = ${id} AND status = 'ready'`;
  if (!m) return Response.json({ error: "Meeting not found" }, { status: 404 });
  const [people, utts] = await Promise.all([
    sql`SELECT key, name, role, color, talk_ms AS "talkMs" FROM participants WHERE meeting_id = ${id}`,
    sql`SELECT idx, speaker, start_ms AS "startMs", end_ms AS "endMs", text FROM utterances WHERE meeting_id = ${id} ORDER BY idx`,
  ]);
  try {
    const { content, model } = await generateSummary(template, m.title, utts as Utterance[], people as Participant[]);
    await sql`
      INSERT INTO summaries (meeting_id, template_key, content, model) VALUES (${id}, ${template}, ${JSON.stringify(content)}::jsonb, ${model})
      ON CONFLICT (meeting_id, template_key) DO UPDATE SET content = EXCLUDED.content, model = EXCLUDED.model, created_at = now()`;
    return Response.json(content);
  } catch (e) {
    console.error("summary failed", e);
    const busy = /429|RESOURCE_EXHAUSTED/.test(String(e));
    return Response.json(
      { error: busy ? "The free AI tier is rate-limited right now. Give it a few seconds" : "Couldn't generate notes" },
      { status: busy ? 429 : 500 }
    );
  }
}
