"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Link2, LocateFixed, Scissors, Search, Sparkles, X } from "lucide-react";
import type { Participant, Utterance } from "@/lib/types";
import { clock, cn } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { indexAt, usePlayer, useTime } from "./player-store";

export function TranscriptPanel({
  utterances,
  participants,
  speakerFilter,
  setSpeakerFilter,
  onClip,
  meetingUrl,
}: {
  utterances: Utterance[];
  participants: Participant[];
  speakerFilter: number | null;
  setSpeakerFilter: (k: number | null) => void;
  onClip?: (startMs: number, endMs: number, note: string) => void; // omitted on read-only share pages
  meetingUrl: string;
}) {
  const p = usePlayer();
  const t = useTime(250);
  const [q, setQ] = useState("");
  const [matchPos, setMatchPos] = useState(0);
  const [follow, setFollow] = useState(true);
  const [selection, setSelection] = useState<{ from: number; to: number; top: number; text: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const byKey = useMemo(() => new Map(participants.map((x) => [x.key, x])), [participants]);
  const active = indexAt(utterances, t);

  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () => (needle.length > 1 ? utterances.filter((u) => u.text.toLowerCase().includes(needle)).map((u) => u.idx) : []),
    [needle, utterances]
  );
  const visible = useMemo(
    () => (speakerFilter == null ? utterances : utterances.filter((u) => u.speaker === speakerFilter)),
    [utterances, speakerFilter]
  );

  const scrollTo = useCallback((idx: number, smooth = true) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (!el || !scroller.current) return;
    const box = scroller.current;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - box.clientHeight / 3;
    box.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Follow along: keep the spoken line in view unless the user scrolled away.
  useEffect(() => {
    if (follow && active >= 0 && !needle) scrollTo(utterances[active].idx);
  }, [active, follow, needle, scrollTo, utterances]);

  useEffect(() => {
    if (matches.length) scrollTo(matches[Math.min(matchPos, matches.length - 1)]);
  }, [matchPos, matches, scrollTo]);

  // "/" focuses transcript search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea")) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !scroller.current) return setSelection(null);
    const rowOf = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>("[data-idx]");
    const a = rowOf(sel.anchorNode);
    const b = rowOf(sel.focusNode);
    if (!a || !b) return setSelection(null);
    const i1 = Number(a.dataset.idx);
    const i2 = Number(b.dataset.idx);
    const from = Math.min(i1, i2);
    const to = Math.max(i1, i2);
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const box = scroller.current.getBoundingClientRect();
    setSelection({ from, to, top: rect.top - box.top + scroller.current.scrollTop - 40, text: sel.toString().trim() });
  };

  const byIdx = useMemo(() => new Map(utterances.map((u) => [u.idx, u])), [utterances]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <div className="flex h-8 min-w-[180px] flex-1 items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 focus-within:border-accent">
          <Search size={14} className="text-ink-3" />
          <input
            ref={searchInput}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMatchPos(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length) setMatchPos((m) => (e.shiftKey ? (m - 1 + matches.length) % matches.length : (m + 1) % matches.length));
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Search transcript  ( / )"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
          {needle.length > 1 && (
            <>
              <span className="text-[11.5px] text-ink-3 tabular-nums">{matches.length ? `${Math.min(matchPos, matches.length - 1) + 1}/${matches.length}` : "0"}</span>
              <button className="text-ink-3 hover:text-ink" onClick={() => setMatchPos((m) => (m - 1 + matches.length) % Math.max(1, matches.length))} aria-label="Previous match">
                <ChevronUp size={14} />
              </button>
              <button className="text-ink-3 hover:text-ink" onClick={() => setMatchPos((m) => (m + 1) % Math.max(1, matches.length))} aria-label="Next match">
                <ChevronDown size={14} />
              </button>
            </>
          )}
        </div>
        <select
          value={speakerFilter ?? ""}
          onChange={(e) => setSpeakerFilter(e.target.value === "" ? null : Number(e.target.value))}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink-2 outline-none"
          aria-label="Filter by speaker"
        >
          <option value="">Everyone</option>
          {participants.map((x) => (
            <option key={x.key} value={x.key}>
              {x.name}
            </option>
          ))}
        </select>
      </div>

      {speakerFilter != null && (
        <div className="flex items-center gap-2 border-b border-line bg-accent-soft/50 px-4 py-1.5 text-[12.5px] text-ink-2">
          Showing only <b className="font-medium text-ink">{byKey.get(speakerFilter)?.name}</b> · {visible.length} of {utterances.length} lines
          <button className="ml-auto flex items-center gap-1 text-accent hover:underline" onClick={() => setSpeakerFilter(null)}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="scroll-thin absolute inset-0 overflow-y-auto px-2 py-2"
          // Only real user input pauses follow-along; our own smooth scrolls never do.
          onWheel={() => follow && setFollow(false)}
          onTouchMove={() => follow && setFollow(false)}
          onKeyDown={(e) => ["PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) && follow && setFollow(false)}
          onMouseUp={onClip ? onMouseUp : undefined}
        >
          {visible.map((u, i) => {
            const prev = visible[i - 1];
            const person = byKey.get(u.speaker);
            return (
              <Line
                key={u.idx}
                u={u}
                name={person?.name ?? `Speaker ${u.speaker + 1}`}
                color={person?.color ?? "#999"}
                showName={!prev || prev.speaker !== u.speaker || u.startMs - prev.endMs > 60000}
                isActive={utterances[active]?.idx === u.idx}
                isPast={u.endMs < t}
                needle={needle}
                isCurrentMatch={matches.length > 0 && matches[Math.min(matchPos, matches.length - 1)] === u.idx}
                onSeek={p.seek}
                onClip={onClip}
                meetingUrl={meetingUrl}
              />
            );
          })}
          {selection && onClip && (
            <button
              style={{ top: Math.max(4, selection.top) }}
              className="animate-fade-up absolute left-1/2 z-10 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white shadow-pop hover:bg-ink/85"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const a = byIdx.get(selection.from)!;
                const b = byIdx.get(selection.to)!;
                onClip(a.startMs, b.endMs, selection.text.slice(0, 140));
                window.getSelection()?.removeAllRanges();
                setSelection(null);
              }}
            >
              <Scissors size={13} /> Clip selection ({clock(byIdx.get(selection.to)!.endMs - byIdx.get(selection.from)!.startMs)})
            </button>
          )}
        </div>
        {!follow && (
          <button
            onClick={() => {
              setFollow(true);
              if (active >= 0) scrollTo(utterances[active].idx);
            }}
            className="animate-fade-up absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-medium text-ink shadow-pop hover:bg-sunken"
          >
            <LocateFixed size={13} className="text-accent" /> Resume following
          </button>
        )}
      </div>
    </div>
  );
}

const Line = memo(function Line({
  u,
  name,
  color,
  showName,
  isActive,
  isPast,
  needle,
  isCurrentMatch,
  onSeek,
  onClip,
  meetingUrl,
}: {
  u: Utterance;
  name: string;
  color: string;
  showName: boolean;
  isActive: boolean;
  isPast: boolean;
  needle: string;
  isCurrentMatch: boolean;
  onSeek: (ms: number) => void;
  onClip?: (s: number, e: number, note: string) => void;
  meetingUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div data-idx={u.idx} className={cn("group relative rounded-lg px-2.5 py-1.5", showName && "mt-2", isActive && "bg-accent-soft/70", isCurrentMatch && "ring-2 ring-hl-strong")}>
      {showName && (
        <div className="mb-0.5 flex items-center gap-2">
          <Avatar name={name} color={color} size={20} />
          <span className="text-[12.5px] font-semibold">{name}</span>
          <button onClick={() => onSeek(u.startMs)} className="font-mono text-[11px] text-ink-3 hover:text-accent">
            {clock(u.startMs)}
          </button>
        </div>
      )}
      <p
        onClick={() => {
          if (!window.getSelection()?.toString()) onSeek(u.startMs);
        }}
        className={cn("cursor-pointer pl-7 text-[13.5px] leading-relaxed", isPast || isActive ? "text-ink" : "text-ink-2")}
      >
        {needle.length > 1 ? <Marked text={u.text} needle={needle} /> : u.text}
      </p>
      <div className="absolute top-1 right-1 hidden items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm group-hover:flex">
        {onClip && (
          <button
            title="Highlight this line"
            onClick={() => onClip(u.startMs, u.endMs, u.text.slice(0, 140))}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-3 hover:bg-hl hover:text-ink"
          >
            <Sparkles size={13} />
          </button>
        )}
        {meetingUrl && <button
          title={copied ? "Copied!" : "Copy link to this moment"}
          onClick={() => {
            navigator.clipboard.writeText(`${meetingUrl}?t=${u.startMs}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className={cn("flex h-6 w-6 items-center justify-center rounded-md hover:bg-sunken", copied ? "text-ok" : "text-ink-3 hover:text-ink")}
        >
          <Link2 size={13} />
        </button>}
      </div>
    </div>
  );
});

function Marked({ text, needle }: { text: string; needle: string }) {
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  let k = 0;
  while (true) {
    const j = lower.indexOf(needle, i);
    if (j < 0) break;
    parts.push(text.slice(i, j), <mark key={k++}>{text.slice(j, j + needle.length)}</mark>);
    i = j + needle.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}
