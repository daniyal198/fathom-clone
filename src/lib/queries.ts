import "server-only";
import { sql } from "./db";
import type { ActionItem, Chapter, Highlight, Participant, SummaryContent, Utterance } from "./types";

export type MeetingRow = {
  id: string;
  title: string;
  sourceTitle: string | null;
  startedAt: string;
  durationMs: number;
  mediaUrl: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  recordedOn: string | null;
  platform: string;
  meetingType: string;
  defaultTemplate: string;
  status: string;
  statusDetail: string | null;
  sharedWithMe: boolean;
  shareToken: string | null;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function toMeeting(r: Record<string, any>): MeetingRow {
  return {
    id: r.id,
    title: r.title,
    sourceTitle: r.source_title,
    startedAt: iso(r.started_at),
    durationMs: r.duration_ms,
    mediaUrl: r.media_url,
    sourceUrl: r.source_url,
    sourceLabel: r.source_label,
    recordedOn: r.recorded_on ? iso(r.recorded_on).slice(0, 10) : null,
    platform: r.platform,
    meetingType: r.meeting_type,
    defaultTemplate: r.default_template,
    status: r.status,
    statusDetail: r.status_detail,
    sharedWithMe: r.shared_with_me,
    shareToken: r.share_token,
  };
}

export type MeetingListItem = MeetingRow & {
  participants: { name: string; color: string }[];
  tldr: string | null;
  actionCount: number;
  openActionCount: number;
  highlightCount: number;
};

// Demo data is seeded once but viewed for days: when the newest meeting falls behind, roll every
// seeded date forward by whole days so "yesterday's standup" stays yesterday and the calendar stays upcoming.
async function keepDemoFresh() {
  await sql`
    WITH s AS (SELECT ((now() AT TIME ZONE 'America/Los_Angeles')::date - max(started_at AT TIME ZONE 'America/Los_Angeles')::date) AS d FROM meetings),
    m AS (UPDATE meetings SET started_at = started_at + make_interval(days => (SELECT d FROM s)) WHERE (SELECT d FROM s) >= 1 RETURNING 1),
    c AS (UPDATE calendar_events SET starts_at = starts_at + make_interval(days => (SELECT d FROM s)),
                                     ends_at = ends_at + make_interval(days => (SELECT d FROM s))
          WHERE (SELECT d FROM s) >= 1 RETURNING 1)
    UPDATE highlights SET created_at = created_at + make_interval(days => (SELECT d FROM s)) WHERE (SELECT d FROM s) >= 1`;
}

export async function listMeetings(): Promise<MeetingListItem[]> {
  await keepDemoFresh();
  const rows = await sql`
    SELECT m.*,
      COALESCE((SELECT json_agg(json_build_object('name', p.name, 'color', p.color) ORDER BY p.talk_ms DESC)
                FROM participants p WHERE p.meeting_id = m.id), '[]') AS people,
      (SELECT s.content->>'tldr' FROM summaries s WHERE s.meeting_id = m.id AND s.template_key = 'general') AS tldr,
      (SELECT count(*)::int FROM action_items a WHERE a.meeting_id = m.id) AS action_count,
      (SELECT count(*)::int FROM action_items a WHERE a.meeting_id = m.id AND NOT a.done) AS open_action_count,
      (SELECT count(*)::int FROM highlights h WHERE h.meeting_id = m.id) AS highlight_count
    FROM meetings m ORDER BY m.started_at DESC`;
  return rows.map((r) => ({
    ...toMeeting(r),
    participants: r.people,
    tldr: r.tldr,
    actionCount: r.action_count,
    openActionCount: r.open_action_count,
    highlightCount: r.highlight_count,
  }));
}

export async function getMeeting(id: string) {
  const [m] = await sql`SELECT * FROM meetings WHERE id = ${id}`;
  if (!m) return null;
  const [people, utts, chapters, summaries, actions, highlights] = await Promise.all([
    sql`SELECT key, name, role, color, talk_ms FROM participants WHERE meeting_id = ${id} ORDER BY talk_ms DESC`,
    sql`SELECT idx, speaker, start_ms, end_ms, text FROM utterances WHERE meeting_id = ${id} ORDER BY idx`,
    sql`SELECT idx, title, gist, start_ms, end_ms FROM chapters WHERE meeting_id = ${id} ORDER BY idx`,
    sql`SELECT template_key, content, model FROM summaries WHERE meeting_id = ${id}`,
    sql`SELECT id, text, assignee, start_ms, done FROM action_items WHERE meeting_id = ${id} ORDER BY start_ms NULLS LAST, id`,
    sql`SELECT * FROM highlights WHERE meeting_id = ${id} ORDER BY start_ms`,
  ]);
  return {
    meeting: toMeeting(m),
    participants: people.map((p) => ({ key: p.key, name: p.name, role: p.role, color: p.color, talkMs: p.talk_ms })) as Participant[],
    utterances: utts.map((u) => ({ idx: u.idx, speaker: u.speaker, startMs: u.start_ms, endMs: u.end_ms, text: u.text })) as Utterance[],
    chapters: chapters.map((c) => ({ idx: c.idx, title: c.title, gist: c.gist, startMs: c.start_ms, endMs: c.end_ms })) as Chapter[],
    summaries: Object.fromEntries(summaries.map((s) => [s.template_key, s.content as SummaryContent])) as Record<string, SummaryContent>,
    actionItems: actions.map((a) => ({ id: a.id, text: a.text, assignee: a.assignee, startMs: a.start_ms, done: a.done })) as ActionItem[],
    highlights: highlights.map(toHighlight),
  };
}
export type MeetingData = NonNullable<Awaited<ReturnType<typeof getMeeting>>>;

export function toHighlight(h: Record<string, any>): Highlight {
  return {
    id: h.id,
    meetingId: h.meeting_id,
    startMs: h.start_ms,
    endMs: h.end_ms,
    note: h.note,
    shareToken: h.share_token,
    source: h.source,
    createdAt: iso(h.created_at),
  };
}

export async function listHighlights() {
  const rows = await sql`
    SELECT h.*, m.title AS meeting_title, m.started_at AS meeting_started_at, m.media_url,
      (SELECT string_agg(u.text, ' ' ORDER BY u.idx) FROM utterances u
        WHERE u.meeting_id = h.meeting_id AND u.end_ms > h.start_ms AND u.start_ms < h.end_ms) AS excerpt,
      (SELECT p.name FROM utterances u JOIN participants p ON p.meeting_id = u.meeting_id AND p.key = u.speaker
        WHERE u.meeting_id = h.meeting_id AND u.end_ms > h.start_ms ORDER BY u.idx LIMIT 1) AS speaker
    FROM highlights h JOIN meetings m ON m.id = h.meeting_id
    ORDER BY h.created_at DESC`;
  return rows.map((r) => ({
    ...toHighlight(r),
    meetingTitle: r.meeting_title as string,
    meetingStartedAt: iso(r.meeting_started_at),
    excerpt: (r.excerpt as string | null) ?? "",
    speaker: r.speaker as string | null,
  }));
}

export async function getShare(token: string) {
  const [h] = await sql`SELECT * FROM highlights WHERE share_token = ${token}`;
  if (h) {
    const data = await getMeeting(h.meeting_id);
    return data ? { kind: "clip" as const, highlight: toHighlight(h), data } : null;
  }
  const [m] = await sql`SELECT id FROM meetings WHERE share_token = ${token}`;
  if (m) {
    const data = await getMeeting(m.id);
    return data ? { kind: "meeting" as const, data } : null;
  }
  return null;
}

export type SearchHit = {
  meetingId: string;
  meetingTitle: string;
  startedAt: string;
  kind: "transcript" | "action" | "title";
  startMs: number | null;
  speaker: string | null;
  color: string | null;
  snippet: string; // contains <mark> tags from ts_headline
};

export async function search(q: string, limit = 60): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];
  const like = `%${query.replace(/[%_]/g, "")}%`;
  // Full-text (stemmed) OR plain substring, so both "pricing" ~ "priced" and partial words match.
  const rows = await sql`
    WITH q AS (SELECT websearch_to_tsquery('english', ${query}) AS tq)
    SELECT * FROM (
      SELECT m.id AS meeting_id, m.title AS meeting_title, m.started_at, 'title' AS kind, NULL::int AS start_ms,
             NULL AS speaker, NULL AS color, m.title AS snippet, 3.0 AS rank
      FROM meetings m WHERE m.title ILIKE ${like}
      UNION ALL
      SELECT m.id, m.title, m.started_at, 'action', a.start_ms, a.assignee, NULL,
             ts_headline('english', a.text, q.tq, 'StartSel=<mark>,StopSel=</mark>,HighlightAll=true'),
             2.0 + ts_rank(a.tsv, q.tq)
      FROM action_items a JOIN meetings m ON m.id = a.meeting_id, q
      WHERE a.tsv @@ q.tq OR a.text ILIKE ${like}
      UNION ALL
      SELECT m.id, m.title, m.started_at, 'transcript', u.start_ms, p.name, p.color,
             ts_headline('english', u.text, q.tq, 'StartSel=<mark>,StopSel=</mark>,MaxWords=28,MinWords=12,MaxFragments=1'),
             ts_rank(u.tsv, q.tq) + CASE WHEN u.text ILIKE ${like} THEN 0.5 ELSE 0 END
      FROM utterances u JOIN meetings m ON m.id = u.meeting_id
        LEFT JOIN participants p ON p.meeting_id = u.meeting_id AND p.key = u.speaker, q
      WHERE u.tsv @@ q.tq OR u.text ILIKE ${like}
    ) hits
    ORDER BY rank DESC, started_at DESC, start_ms
    LIMIT ${limit}`;
  return rows.map((r) => ({
    meetingId: r.meeting_id,
    meetingTitle: r.meeting_title,
    startedAt: iso(r.started_at),
    kind: r.kind,
    startMs: r.start_ms,
    speaker: r.speaker,
    color: r.color,
    snippet: markSubstring(r.snippet as string, query),
  }));
}

// ts_headline marks stemmed matches only; also mark the literal substring when the ILIKE branch matched.
// Output is rendered as HTML, so escape everything except our own <mark> tags.
function markSubstring(raw: string, q: string) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (raw.includes("<mark>")) {
    return raw.split(/(<\/?mark>)/).map((part) => (part === "<mark>" || part === "</mark>" ? part : esc(part))).join("");
  }
  const i = raw.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(raw);
  return `${esc(raw.slice(0, i))}<mark>${esc(raw.slice(i, i + q.length))}</mark>${esc(raw.slice(i + q.length))}`;
}

export async function getCalendar() {
  await keepDemoFresh();
  const [settings] = await sql`SELECT * FROM settings WHERE id = 1`;
  const events = await sql`SELECT * FROM calendar_events WHERE ends_at > now() - interval '12 hours' ORDER BY starts_at`;
  return {
    connected: settings?.calendar_connected ?? false,
    email: (settings?.calendar_email as string | null) ?? null,
    autoRecord: (settings?.auto_record as string) ?? "all",
    events: events.map((e) => ({
      id: e.id as string,
      title: e.title as string,
      startsAt: iso(e.starts_at),
      endsAt: iso(e.ends_at),
      attendees: e.attendees as string[],
      platform: e.platform as string,
      external: e.external as boolean,
      record: e.record as boolean,
      replayOf: e.replay_of as string | null,
      meetingId: e.meeting_id as string | null,
    })),
  };
}
export type CalendarEvent = Awaited<ReturnType<typeof getCalendar>>["events"][number];
