import { after } from "next/server";
import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { ingestUpload } from "@/lib/pipeline";
import { TEMPLATES } from "@/lib/ai/templates";

export const maxDuration = 60;

// Create a meeting from an uploaded recording; transcription and notes run after the response.
export async function POST(req: Request) {
  const { title, mediaUrl, template = "general", source = "upload" } = (await req.json()) as {
    title?: string;
    mediaUrl: string;
    template?: string;
    source?: "upload" | "mic";
  };
  const blobHost = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;
  if (!mediaUrl || !blobHost.test(mediaUrl)) return Response.json({ error: "Upload the file first" }, { status: 400 });
  const tpl = TEMPLATES.some((t) => t.key === template) ? template : "general";
  const id = `rec-${nanoid(8)}`.toLowerCase();
  await sql`
    INSERT INTO meetings (id, title, started_at, duration_ms, media_url, source_label, platform, default_template, status, status_detail)
    VALUES (${id}, ${(title || "Untitled recording").slice(0, 120)}, now(), 0, ${mediaUrl},
            ${source === "mic" ? "Recorded in browser" : "Uploaded recording"}, 'upload', ${tpl}, 'processing', 'Uploading recording')`;
  after(() => ingestUpload(id, mediaUrl));
  return Response.json({ id });
}
