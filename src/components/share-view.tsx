"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Play } from "lucide-react";
import type { MeetingData } from "@/lib/queries";
import type { Highlight } from "@/lib/types";
import { clock, cn, duration, shortDate, thumbFor } from "@/lib/format";
import { Avatar, AvatarStack, Logo } from "@/components/ui";
import { PlayerProvider, indexAt, usePlayer, useTime } from "./meeting/player-store";
import { VideoPlayer } from "./meeting/video-player";
import { SummaryPanel } from "./meeting/summary-panel";
import { TranscriptPanel } from "./meeting/transcript-panel";
import { ActionsPanel } from "./meeting/actions-panel";

function TopBar({ label }: { label: string }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold">Plumb</span>
        </Link>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{label}</span>
        <Link href="/" className="ml-auto inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong">
          Try Plumb free
        </Link>
      </div>
    </header>
  );
}

export function SharedClip({ data, highlight }: { data: MeetingData; highlight: Highlight }) {
  return (
    <PlayerProvider>
      <TopBar label="Shared clip" />
      <ClipInner data={data} highlight={highlight} />
    </PlayerProvider>
  );
}

function ClipInner({ data, highlight: h }: { data: MeetingData; highlight: Highlight }) {
  const { meeting, participants, utterances } = data;
  const p = usePlayer();
  const t = useTime(250);
  const lines = utterances.filter((u) => u.endMs > h.startMs && u.startMs < h.endMs);
  const byKey = new Map(participants.map((x) => [x.key, x]));
  const speakers = [...new Set(lines.map((l) => l.speaker))].map((k) => byKey.get(k)!).filter(Boolean);
  const active = indexAt(lines, t);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <h1 className="text-[20px] leading-snug font-semibold tracking-tight">{h.note || `Clip from ${meeting.title}`}</h1>
          <p className="mt-1 mb-4 text-[13px] text-ink-3">
            {clock(h.endMs - h.startMs)} clip · from <b className="font-medium text-ink-2">{meeting.title}</b> · {shortDate(meeting.startedAt)}
          </p>
          <VideoPlayer
            src={meeting.mediaUrl!}
            poster={thumbFor(meeting)}
            durationMs={meeting.durationMs}
            utterances={utterances}
            participants={participants}
            chapters={[]}
            highlights={[]}
            clipRange={{ startMs: h.startMs, endMs: h.endMs }}
          />
          <button
            onClick={() => p.playClip(h.startMs, h.endMs)}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium hover:bg-sunken"
          >
            <Play size={12} fill="currentColor" /> Play clip from the start
          </button>
        </div>
        <aside className="rounded-xl border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <AvatarStack people={speakers} size={22} />
            <span className="text-[13px] text-ink-2">{speakers.map((s) => s.name).join(", ")}</span>
          </div>
          <div className="space-y-3 px-4 py-4">
            {lines.map((u, i) => {
              const who = byKey.get(u.speaker);
              return (
                <button key={u.idx} onClick={() => p.seek(Math.max(u.startMs, h.startMs))} className={cn("block w-full rounded-lg p-2 text-left", i === active && "bg-accent-soft/70")}>
                  <span className="mb-0.5 flex items-center gap-2">
                    <Avatar name={who?.name ?? "?"} color={who?.color} size={18} />
                    <span className="text-[12.5px] font-semibold">{who?.name}</span>
                    <span className="font-mono text-[11px] text-ink-3">{clock(u.startMs)}</span>
                  </span>
                  <span className="block pl-[26px] text-[13.5px] leading-relaxed text-ink-2">{u.text}</span>
                </button>
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 border-t border-line px-4 py-3 text-[12px] text-ink-3">
            <Lock size={12} /> The rest of this meeting is private to its owner.
          </p>
        </aside>
      </div>
    </main>
  );
}

export function SharedMeeting({ data }: { data: MeetingData }) {
  const [tab, setTab] = useState<"summary" | "transcript" | "actions">("summary");
  const [speaker, setSpeaker] = useState<number | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const { meeting, participants, utterances, chapters, highlights } = data;
  return (
    <PlayerProvider>
      <TopBar label="Shared meeting" />
      <main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6">
        <h1 className="text-[20px] font-semibold tracking-tight">{meeting.title}</h1>
        <div className="mt-1 mb-4 flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
          <span>{shortDate(meeting.startedAt)}</span>
          <span>{duration(meeting.durationMs)}</span>
          <AvatarStack people={participants} size={20} max={6} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
          <VideoPlayer
            src={meeting.mediaUrl!}
            poster={thumbFor(meeting)}
            durationMs={meeting.durationMs}
            utterances={utterances}
            participants={participants}
            chapters={chapters}
            highlights={highlights}
          />
          <aside className="flex h-[75vh] min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
            <nav className="flex shrink-0 border-b border-line px-2">
              {(["summary", "transcript", "actions"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn("-mb-px h-11 border-b-2 px-3 text-[13px] font-medium capitalize", tab === k ? "border-accent text-ink" : "border-transparent text-ink-3")}
                >
                  {k === "actions" ? "Action items" : k}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1">
              {tab === "summary" && (
                <SummaryPanel meetingId={meeting.id} title={meeting.title} initial={data.summaries} defaultTemplate={meeting.defaultTemplate} readOnly meetingUrl="" />
              )}
              {tab === "transcript" && (
                <TranscriptPanel utterances={utterances} participants={participants} speakerFilter={speaker} setSpeakerFilter={setSpeaker} meetingUrl="" />
              )}
              {tab === "actions" && <ActionsPanel items={data.actionItems} participants={participants} readOnly person={person} setPerson={setPerson} />}
            </div>
          </aside>
        </div>
      </main>
    </PlayerProvider>
  );
}
