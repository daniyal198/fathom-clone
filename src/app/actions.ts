"use server";

import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { toHighlight } from "@/lib/queries";
import type { Highlight } from "@/lib/types";

const MAX_CLIP_MS = 10 * 60 * 1000;

export async function toggleActionItem(id: number, done: boolean) {
  await sql`UPDATE action_items SET done = ${done} WHERE id = ${id}`;
}

export async function addHighlight(meetingId: string, startMs: number, endMs: number, note = "", source = "manual"): Promise<Highlight> {
  const s = Math.max(0, Math.round(Math.min(startMs, endMs)));
  const e = Math.round(Math.min(Math.max(startMs, endMs), s + MAX_CLIP_MS));
  const [row] = await sql`
    INSERT INTO highlights (id, meeting_id, start_ms, end_ms, note, source)
    VALUES (${nanoid(10)}, ${meetingId}, ${s}, ${Math.max(e, s + 1000)}, ${note.slice(0, 500)}, ${source})
    RETURNING *`;
  return toHighlight(row);
}

export async function updateHighlight(id: string, patch: { note?: string; startMs?: number; endMs?: number }) {
  const [row] = await sql`
    UPDATE highlights SET
      note = COALESCE(${patch.note?.slice(0, 500) ?? null}, note),
      start_ms = COALESCE(${patch.startMs != null ? Math.max(0, Math.round(patch.startMs)) : null}::int, start_ms),
      end_ms = COALESCE(${patch.endMs != null ? Math.round(patch.endMs) : null}::int, end_ms)
    WHERE id = ${id} RETURNING *`;
  return row ? toHighlight(row) : null;
}

export async function deleteHighlight(id: string) {
  await sql`DELETE FROM highlights WHERE id = ${id}`;
}

export async function shareHighlight(id: string) {
  const [row] = await sql`
    UPDATE highlights SET share_token = COALESCE(share_token, ${nanoid(12)}) WHERE id = ${id} RETURNING share_token`;
  return row?.share_token as string;
}

export async function shareMeeting(meetingId: string) {
  const [row] = await sql`
    UPDATE meetings SET share_token = COALESCE(share_token, ${nanoid(12)}) WHERE id = ${meetingId} RETURNING share_token`;
  return row?.share_token as string;
}

export async function connectCalendar(email: string) {
  await sql`UPDATE settings SET calendar_connected = true, calendar_email = ${email.slice(0, 120) || "you@company.com"} WHERE id = 1`;
}

export async function disconnectCalendar() {
  await sql`UPDATE settings SET calendar_connected = false, calendar_email = null WHERE id = 1`;
}

export async function setAutoRecord(mode: "all" | "external" | "internal" | "none") {
  await sql`UPDATE settings SET auto_record = ${mode} WHERE id = 1`;
  // Apply the rule to every upcoming event that has a video link, like the real product does.
  await sql`
    UPDATE calendar_events SET record = CASE
      WHEN ${mode} = 'all' THEN true
      WHEN ${mode} = 'external' THEN external
      WHEN ${mode} = 'internal' THEN NOT external
      ELSE false END
    WHERE platform <> 'none' AND meeting_id IS NULL`;
}

export async function setEventRecord(eventId: string, record: boolean) {
  await sql`UPDATE calendar_events SET record = ${record} WHERE id = ${eventId} AND platform <> 'none'`;
}

export async function renameSpeaker(meetingId: string, key: number, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  const [old] = await sql`SELECT name FROM participants WHERE meeting_id = ${meetingId} AND key = ${key}`;
  if (!old) return;
  await sql`UPDATE participants SET name = ${clean} WHERE meeting_id = ${meetingId} AND key = ${key}`;
  // Keep action-item owners in step with the corrected name.
  await sql`UPDATE action_items SET assignee = ${clean} WHERE meeting_id = ${meetingId} AND assignee = ${old.name}`;
}
