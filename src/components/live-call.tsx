"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Gauge, Loader2, PhoneOff, Sparkles } from "lucide-react";
import type { Participant, Utterance } from "@/lib/types";
import { clock, cn } from "@/lib/format";
import { Avatar, Logo } from "@/components/ui";

type LiveHighlight = { startMs: number; endMs: number; note: string };
const PLATFORM: Record<string, string> = { zoom: "Zoom", meet: "Google Meet", teams: "Teams" };

export function LiveCall({
  event,
  mediaUrl,
  utterances,
  participants,
}: {
  event: { id: string; title: string; platform: string };
  mediaUrl: string;
  utterances: Utterance[];
  participants: Participant[];
}) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"lobby" | "live" | "ending">("lobby");
  const [t, setT] = useState(0);
  const [fast, setFast] = useState(false);
  const [marks, setMarks] = useState<LiveHighlight[]>([]);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byKey = new Map(participants.map((p) => [p.key, p]));

  useEffect(() => {
    if (phase !== "live") return;
    let raf = 0;
    const tick = () => {
      setT(Math.round((video.current?.currentTime ?? 0) * 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const spoken = utterances.filter((u) => u.startMs <= t);
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [spoken.length]);

  const mark = useCallback(() => {
    if (phase !== "live") return;
    const now = Math.round((video.current?.currentTime ?? 0) * 1000);
    const line = [...utterances].reverse().find((u) => u.startMs <= now);
    setMarks((m) => [...m, { startMs: Math.max(0, now - 10000), endMs: now + 5000, note: line ? line.text.split(/(?<=[.?!])\s/)[0].slice(0, 120) : "" }]);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
  }, [phase, utterances]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h" && !(e.target as HTMLElement).closest("input, textarea")) mark();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mark]);

  const join = () => {
    setPhase("live");
    requestAnimationFrame(() => video.current?.play().catch(() => {}));
  };

  const end = async () => {
    const elapsed = Math.round((video.current?.currentTime ?? 0) * 1000);
    video.current?.pause();
    setPhase("ending");
    try {
      const res = await fetch(`/api/live/${event.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elapsedMs: elapsed, highlights: marks.map((m) => ({ ...m, endMs: Math.min(m.endMs, elapsed) })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the recording");
      router.push(`/meetings/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("live");
    }
  };

  if (phase === "lobby") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-pop">
          <Link href="/calendar" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
            <ArrowLeft size={14} /> Calendar
          </Link>
          <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">{PLATFORM[event.platform] ?? "Video"} call</p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight">{event.title}</h1>
          <div className="mt-3 flex items-center gap-2">
            {participants.slice(0, 8).map((p) => (
              <Avatar key={p.key} name={p.name} color={p.color} size={26} />
            ))}
          </div>
          <div className="mt-5 flex gap-3 rounded-xl bg-accent-soft/60 p-3 text-[13px] text-ink-2">
            <Bot size={18} className="mt-0.5 shrink-0 text-accent" />
            <p>
              <b className="font-medium text-ink">Plumb Notetaker</b> will join, record and transcribe. Press <b className="font-medium text-ink">H</b> or the
              Highlight button whenever something matters.
            </p>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">Demo: this replays a real recorded call as if it were live. When you hang up, only the part you sat through becomes the recording.</p>
          <button onClick={join} className="mt-5 h-10 w-full rounded-xl bg-accent text-[14px] font-medium text-white hover:bg-accent-strong">
            Join call
          </button>
        </div>
      </div>
    );
  }

  const current = spoken.at(-1);
  return (
    <div className="flex h-screen flex-col bg-[#101014] text-white">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <Logo className="h-5 w-5" />
        <span className="truncate text-[13.5px] font-medium">{event.title}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[12px] font-medium text-red-400">
          <span className="animate-pulse-dot h-2 w-2 rounded-full bg-red-500" /> REC {clock(t)}
        </span>
        <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-white/50 sm:flex">
          <Bot size={14} /> Plumb Notetaker is recording
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3">
          <video ref={video} src={mediaUrl} playsInline className="max-h-full max-w-full rounded-lg" onEnded={end} />
          {flash && <div className="pointer-events-none absolute inset-0 border-4 border-hl-strong" />}
          {current && (
            <div className="absolute bottom-6 left-1/2 max-w-[80%] -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1.5 text-center text-[13.5px]">
              <b className="font-medium" style={{ color: byKey.get(current.speaker)?.color }}>{byKey.get(current.speaker)?.name}: </b>
              {revealed(current, t)}
            </div>
          )}
        </div>
        <aside className="flex h-[40vh] min-h-0 w-full flex-col border-white/10 lg:h-auto lg:w-[380px] lg:border-l">
          <p className="border-b border-white/10 px-4 py-2.5 text-[12px] font-semibold tracking-wide text-white/50 uppercase">Live transcript</p>
          <div ref={feed} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {spoken.length === 0 && <p className="text-[13px] text-white/40">Waiting for someone to speak…</p>}
            {spoken.map((u) => {
              const who = byKey.get(u.speaker);
              return (
                <div key={u.idx} className="animate-fade-up">
                  <p className="text-[12px] font-semibold" style={{ color: who?.color }}>
                    {who?.name} <span className="font-mono font-normal text-white/35">{clock(u.startMs)}</span>
                  </p>
                  <p className="text-[13.5px] leading-relaxed text-white/85">{u === current ? revealed(u, t) : u.text}</p>
                </div>
              );
            })}
          </div>
          {marks.length > 0 && (
            <div className="max-h-36 overflow-y-auto border-t border-white/10 px-4 py-2.5">
              <p className="mb-1.5 text-[11.5px] font-semibold tracking-wide text-white/50 uppercase">Your highlights · {marks.length}</p>
              {marks.map((m, i) => (
                <p key={i} className="truncate text-[12.5px] text-white/75">
                  <span className="mr-1.5 font-mono text-hl-strong">{clock(m.startMs)}</span>
                  {m.note || "Highlight"}
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>

      <footer className="flex h-16 shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4">
        {error && <span className="mr-2 text-[12.5px] text-red-400">{error}</span>}
        <button
          onClick={() => {
            const next = !fast;
            setFast(next);
            if (video.current) video.current.playbackRate = next ? 2 : 1;
          }}
          className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium", fast ? "bg-white/20" : "bg-white/10 hover:bg-white/15")}
          title="Play the call at double speed (demo only)"
        >
          <Gauge size={15} /> {fast ? "2×" : "1×"}
        </button>
        <button
          onClick={mark}
          disabled={phase !== "live"}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-hl-strong px-5 text-[14px] font-semibold text-ink transition-transform hover:brightness-105 active:scale-95"
        >
          <Sparkles size={16} /> Highlight <kbd className="rounded bg-black/10 px-1 text-[11px]">H</kbd>
        </button>
        <button
          onClick={end}
          disabled={phase !== "live"}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-[14px] font-medium hover:bg-red-500"
        >
          {phase === "ending" ? <Loader2 size={16} className="animate-spin" /> : <PhoneOff size={16} />} {phase === "ending" ? "Saving…" : "End call"}
        </button>
      </footer>
    </div>
  );
}

// Word-by-word reveal of the line being spoken, like live captions.
function revealed(u: Utterance, t: number) {
  const words = u.text.split(" ");
  const frac = Math.min(1, Math.max(0, (t - u.startMs) / Math.max(1, u.endMs - u.startMs)));
  return words.slice(0, Math.max(1, Math.ceil(words.length * frac))).join(" ");
}
