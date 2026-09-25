import { sql } from "@/lib/db";
import { streamText } from "@/lib/ai/gemini";
import { clock } from "@/lib/ai/notes";

export const maxDuration = 60;

type Turn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request, ctx: RouteContext<"/api/meetings/[id]/ask">) {
  const { id } = await ctx.params;
  const { question, history = [] } = (await req.json()) as { question: string; history?: Turn[] };
  if (!question?.trim()) return new Response("Ask a question", { status: 400 });

  const [m] = await sql`SELECT title, started_at FROM meetings WHERE id = ${id}`;
  if (!m) return new Response("Meeting not found", { status: 404 });
  const [people, utts, actions] = await Promise.all([
    sql`SELECT key, name, role FROM participants WHERE meeting_id = ${id}`,
    sql`SELECT speaker, start_ms, text FROM utterances WHERE meeting_id = ${id} ORDER BY idx`,
    sql`SELECT text, assignee, done FROM action_items WHERE meeting_id = ${id}`,
  ]);
  const name = new Map(people.map((p) => [p.key, p.name]));
  const transcript = utts.map((u) => `[${clock(u.start_ms)}] ${name.get(u.speaker) ?? "Unknown"}: ${u.text}`).join("\n");

  const system = `You answer questions about one recorded meeting, using only its transcript.
- Be direct and concise: lead with the answer, then brief supporting points. Use short bullet lists when listing things.
- Cite the moments you rely on as timestamps, each in its own square brackets exactly like [12:34] [27:08] (or [1:02:03] past an hour), taken from the transcript lines.
- If the transcript doesn't contain the answer, say so plainly. Don't speculate.
- Plain text with "- " bullets and **bold** only. No headings, no tables.`;

  const prompt = `Meeting: "${m.title}"
Participants: ${people.map((p) => p.name + (p.role ? ` (${p.role})` : "")).join(", ")}
Tracked action items: ${actions.map((a) => `${a.text} [${a.assignee ?? "unassigned"}${a.done ? ", done" : ""}]`).join("; ") || "none"}

TRANSCRIPT
${transcript}

${(history as Turn[])
  .slice(-6)
  .map((t) => `${t.role === "user" ? "Q" : "A"}: ${t.text}`)
  .join("\n")}
Q: ${question.slice(0, 1000)}
A:`;

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamText({ system, prompt })) controller.enqueue(encoder.encode(chunk));
      } catch (e) {
        console.error("ask failed", e);
        const busy = /429|RESOURCE_EXHAUSTED/.test(String(e));
        controller.enqueue(encoder.encode(busy ? "\n\n_The free AI tier is rate-limited right now. Try again in a few seconds._" : "\n\n_Something went wrong answering that._"));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
