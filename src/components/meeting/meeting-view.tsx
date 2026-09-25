"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowLeft, CalendarDays, Clock, ExternalLink, Share2, Sparkles, Users } from "lucide-react";
import type { MeetingData } from "@/lib/queries";
import type { Highlight } from "@/lib/types";
import { addHighlight, shareMeeting } from "@/app/actions";
import { clock, cn, duration, pct, shortDate, thumbFor, timeLabel } from "@/lib/format";
import { AvatarStack, Button } from "@/components/ui";
import { PlayerProvider, indexAt, usePlayer, useTime } from "./player-store";
import { VideoPlayer } from "./video-player";
import { TranscriptPanel } from "./transcript-panel";
import { SummaryPanel } from "./summary-panel";
import { ActionsPanel } from "./actions-panel";
import { HighlightsPanel } from "./highlights-panel";
import { AskPanel } from "./ask-panel";
import { ShareDialog } from "./share-dialog";

type Tab = "summary" | "transcript" | "actions" | "highlights" | "ask";

export function MeetingView(props: { data: MeetingData; initialMs: number | null }) {
  return (
    <PlayerProvider>
      <MeetingInner {...props} />
    </PlayerProvider>
  );
}

function MeetingInner({ data, initialMs }: { data: MeetingData; initialMs: number | null }) {
  const { meeting, participants, utterances, chapters, summaries, actionItems } = data;
  const p = usePlayer();
  const [tab, setTab] = useState<Tab>(initialMs != null ? "transcript" : "summary");
  const [highlights, setHighlights] = useState<Highlight[]>(data.highlights);
  const [focusHighlight, setFocusHighlight] = useState<string | null>(null);
  const [speakerFilter, setSpeakerFilter] = useState<number | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const meetingUrl = `${origin}/meetings/${meeting.id}`;

  // Deep links (?t=) arriving via client navigation, e.g. from search.
  useEffect(() => {
    if (initialMs != null && p.videoRef.current?.readyState) {
      p.seek(initialMs, { play: false });
      setTab("transcript");
    }
  }, [initialMs, p]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const createHighlight = useCallback(
    async (startMs: number, endMs: number, note: string, source = "manual") => {
      const h = await addHighlight(meeting.id, startMs, endMs, note, source);
      setHighlights((hs) => [...hs, h]);
      setFocusHighlight(h.id);
      setToast(`Highlight saved at ${clock(h.startMs)}`);
      return h;
    },
    [meeting.id]
  );

  const highlightNow = useCallback(() => {
    const t = p.getTime();
    createHighlight(Math.max(0, t - 10000), t + 15000, "");
    setTab("highlights");
  }, [p, createHighlight]);

  const clipFromTranscript = useCallback(
    (s: number, e: number, note: string) => {
      createHighlight(s, e, note);
      setTab("highlights");
    },
    [createHighlight]
  );

  const focusPerson = (key: number) => {
    const name = participants.find((x) => x.key === key)?.name ?? null;
    setSpeakerFilter(key);
    setPerson(actionItems.some((a) => a.assignee === name) ? name : null);
    setTab("transcript");
  };

  const top = participants[0]?.name;
  const suggestions = [
    "What were the key decisions?",
    top ? `What did ${top} commit to?` : "Who committed to what?",
    "What open questions or risks came up?",
    "Write a short follow-up email to the attendees",
  ];
  const totalTalk = participants.reduce((a, x) => a + x.talkMs, 0);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "summary", label: "Summary" },
    { key: "transcript", label: "Transcript" },
    { key: "actions", label: "Actions", count: actionItems.length },
    { key: "highlights", label: "Highlights", count: highlights.length },
    { key: "ask", label: "Ask AI" },
  ];

  return (
    <div className="flex flex-col lg:h-screen">
      {/* Header */}
      <header className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Back to meetings">
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{meeting.title}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
              <span className="flex items-center gap-1">
                <CalendarDays size={12} /> {shortDate(meeting.startedAt)}, {timeLabel(meeting.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {duration(meeting.durationMs)}
              </span>
              <Popover.Root>
                <Popover.Trigger className="flex items-center gap-1.5 rounded-md hover:text-ink">
                  <Users size={12} /> {participants.length} people
                  <AvatarStack people={participants} size={18} max={5} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content align="start" sideOffset={8} className="z-50 w-[300px] rounded-xl border border-line bg-surface p-3 shadow-pop">
                    <p className="mb-2 text-[12px] font-semibold text-ink-3 uppercase">Talk time</p>
                    <ul className="space-y-2">
                      {participants.map((x) => (
                        <li key={x.key}>
                          <button onClick={() => focusPerson(x.key)} className="w-full text-left">
                            <div className="flex items-center justify-between text-[13px]">
                              <span className="font-medium">{x.name}</span>
                              <span className="text-ink-3 tabular-nums">{pct(x.talkMs, totalTalk)}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
                              <div className="h-full rounded-full" style={{ width: `${pct(x.talkMs, totalTalk)}%`, background: x.color }} />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              {meeting.sourceUrl && (
                <a href={meeting.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink" title={`Originally recorded ${meeting.recordedOn ?? ""}`}>
                  <ExternalLink size={12} /> Source: {meeting.sourceLabel}
                </a>
              )}
            </div>
          </div>
          <Button variant="primary" onClick={() => setSharing(true)}>
            <Share2 size={14} /> Share
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]">
        <div className="scroll-thin min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
          {meeting.mediaUrl ? (
            <VideoPlayer
              src={meeting.mediaUrl}
              poster={thumbFor(meeting)}
              durationMs={meeting.durationMs}
              utterances={utterances}
              participants={participants}
              chapters={chapters}
              highlights={highlights}
              initialMs={initialMs}
              onHighlight={highlightNow}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-line bg-sunken text-ink-3">No recording</div>
          )}
          <Chapters chapters={chapters} />
          <SpeakerLanes data={data} totalTalk={totalTalk} onFocus={focusPerson} />
        </div>

        <aside className="flex h-[80vh] min-h-0 flex-col border-t border-line bg-surface lg:h-auto lg:border-t-0 lg:border-l">
          <nav className="scroll-thin flex shrink-0 overflow-x-auto border-b border-line px-2">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "-mb-px flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors",
                  tab === key ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
                )}
              >
                {label}
                {!!count && <span className="rounded-full bg-sunken px-1.5 text-[10.5px] text-ink-3">{count}</span>}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1">
            {tab === "summary" && (
              <SummaryPanel meetingId={meeting.id} title={meeting.title} initial={summaries} defaultTemplate={meeting.defaultTemplate} meetingUrl={meetingUrl} />
            )}
            {tab === "transcript" && (
              <TranscriptPanel
                utterances={utterances}
                participants={participants}
                speakerFilter={speakerFilter}
                setSpeakerFilter={setSpeakerFilter}
                onClip={clipFromTranscript}
                meetingUrl={meetingUrl}
              />
            )}
            {tab === "actions" && <ActionsPanel items={actionItems} participants={participants} person={person} setPerson={setPerson} />}
            {tab === "highlights" && (
              <HighlightsPanel
                highlights={highlights}
                setHighlights={setHighlights}
                utterances={utterances}
                participants={participants}
                meetingTitle={meeting.title}
                focusId={focusHighlight}
              />
            )}
            {tab === "ask" && <AskPanel meetingId={meeting.id} suggestions={suggestions} />}
          </div>
        </aside>
      </div>

      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        heading="Share this meeting"
        blurb="Recording, AI notes, action items and transcript. Read-only."
        subject={`Recording: ${meeting.title}`}
        getToken={() => shareMeeting(meeting.id)}
      />

      {toast && (
        <div className="animate-fade-up fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-white shadow-pop">
          <Sparkles size={14} className="text-hl-strong" /> {toast}
        </div>
      )}
    </div>
  );
}

function Chapters({ chapters }: { chapters: MeetingData["chapters"] }) {
  const p = usePlayer();
  const t = useTime(1000);
  const active = indexAt(chapters, t);
  if (!chapters.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">
        Chapters <span className="font-normal text-ink-3">· {chapters.length}</span>
      </h2>
      <ol className="p-1.5">
        {chapters.map((c, i) => (
          <li key={c.idx}>
            <button
              onClick={() => p.seek(c.startMs)}
              className={cn("flex w-full gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas", i === active && "bg-accent-soft/60")}
            >
              <span className={cn("mt-px w-12 shrink-0 font-mono text-[12px] tabular-nums", i === active ? "text-accent" : "text-ink-3")}>{clock(c.startMs)}</span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">{c.title}</span>
                <span className="block text-[12.5px] leading-snug text-ink-3">{c.gist}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One lane per person: when they spoke across the whole call. Click a segment to jump there. */
function SpeakerLanes({ data, totalTalk, onFocus }: { data: MeetingData; totalTalk: number; onFocus: (key: number) => void }) {
  const p = usePlayer();
  const t = useTime(500);
  const { participants, utterances, meeting } = data;
  const total = Math.max(meeting.durationMs, 1);
  const byPerson = useMemo(() => {
    const m = new Map<number, typeof utterances>();
    for (const u of utterances) m.set(u.speaker, [...(m.get(u.speaker) ?? []), u]);
    return m;
  }, [utterances]);
  const openItems = (name: string) => data.actionItems.filter((a) => a.assignee === name && !a.done).length;

  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2 className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] font-semibold">
        <span>
          Who spoke when <span className="font-normal text-ink-3">· {participants.length} people</span>
        </span>
        <span className="text-[11.5px] font-normal text-ink-3">Click a name to see only their lines</span>
      </h2>
      <div className="space-y-1 p-3">
        {participants.map((x) => (
          <div key={x.key} className="group flex items-center gap-3">
            <button onClick={() => onFocus(x.key)} className="flex w-[150px] shrink-0 items-center gap-2 truncate text-left text-[12.5px] hover:text-accent">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
              <span className="truncate font-medium">{x.name}</span>
              <span className="ml-auto text-ink-3 tabular-nums">{pct(x.talkMs, totalTalk)}%</span>
            </button>
            <div className="relative h-5 flex-1 rounded bg-canvas">
              {(byPerson.get(x.key) ?? []).map((u) => (
                <button
                  key={u.idx}
                  onClick={() => p.seek(u.startMs)}
                  tabIndex={-1}
                  aria-label={`Jump to ${clock(u.startMs)}`}
                  title={`${clock(u.startMs)} · ${u.text.slice(0, 80)}`}
                  className="absolute top-0.5 bottom-0.5 rounded-[2px] opacity-80 hover:opacity-100"
                  style={{ left: `${(u.startMs / total) * 100}%`, width: `max(2px, ${((u.endMs - u.startMs) / total) * 100}%)`, background: x.color }}
                />
              ))}
              <div className="pointer-events-none absolute inset-y-0 w-px bg-ink/60" style={{ left: `${(t / total) * 100}%` }} />
            </div>
            <span className="hidden w-16 shrink-0 text-right text-[11.5px] text-ink-3 sm:block">
              {openItems(x.name) ? `${openItems(x.name)} to-do` : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
