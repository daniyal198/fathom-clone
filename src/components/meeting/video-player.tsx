"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw, RotateCw, Sparkles, Volume2, VolumeX } from "lucide-react";
import type { Chapter, Highlight, Participant, Utterance } from "@/lib/types";
import { clock, cn } from "@/lib/format";
import { indexAt, usePlayer, useTime } from "./player-store";

const RATES = [1, 1.25, 1.5, 1.75, 2];

export function VideoPlayer({
  src,
  poster,
  durationMs,
  utterances,
  participants,
  chapters,
  highlights,
  initialMs,
  onHighlight,
  clipRange,
}: {
  src: string;
  poster?: string | null;
  durationMs: number;
  utterances: Utterance[];
  participants: Participant[];
  chapters: Chapter[];
  highlights: Highlight[];
  initialMs?: number | null;
  onHighlight?: () => void;
  clipRange?: { startMs: number; endMs: number } | null; // share pages: constrain playback to a clip
}) {
  const p = usePlayer();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const clipRef = useRef(clipRange);
  clipRef.current = clipRange;
  const startRef = useRef(clipRange?.startMs ?? initialMs ?? 0);
  const didInit = useRef(false);

  // Drive subscribers from rAF while playing (smooth), and from events while paused/seeking.
  useEffect(() => {
    const v = p.videoRef.current;
    if (!v) return;
    let raf = 0;
    const loop = () => {
      if (p.clipEnd.current != null && v.currentTime * 1000 >= p.clipEnd.current) {
        v.pause();
        p.clipEnd.current = null;
      }
      const clip = clipRef.current;
      if (clip && v.currentTime * 1000 >= clip.endMs) {
        v.pause();
        v.currentTime = clip.endMs / 1000;
      }
      p.emit();
      raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      p.emit();
    };
    const onMeta = () => {
      setReady(true);
      if (!didInit.current) {
        didInit.current = true;
        if (startRef.current) v.currentTime = startRef.current / 1000;
      }
      p.emit();
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", p.emit);
    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) onMeta();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", p.emit);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [p]);

  // Keyboard: space play/pause, ←/→ 5s, J/L 10s, H highlight. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const v = p.videoRef.current;
      if (!v) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") {
        e.preventDefault();
        p.toggle();
      } else if (k === "arrowleft" || k === "j") p.seek(v.currentTime * 1000 - (k === "j" ? 10000 : 5000), { play: !v.paused });
      else if (k === "arrowright" || k === "l") p.seek(v.currentTime * 1000 + (k === "l" ? 10000 : 5000), { play: !v.paused });
      else if (k === "h" && onHighlight) {
        e.preventDefault();
        onHighlight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p, onHighlight]);

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (p.videoRef.current) p.videoRef.current.playbackRate = next;
  };

  return (
    <div ref={wrap} className="overflow-hidden rounded-xl border border-line bg-ink">
      <div className="relative aspect-video bg-black">
        <video
          ref={p.videoRef}
          src={src}
          poster={poster ?? undefined}
          preload="metadata"
          playsInline
          muted={muted}
          className="h-full w-full cursor-pointer object-contain"
          onClick={p.toggle}
        />
        {!playing && ready && (
          <button
            onClick={p.toggle}
            className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-ink shadow-pop transition-transform hover:scale-105"
            aria-label="Play"
          >
            <Play size={22} className="ml-0.5" fill="currentColor" />
          </button>
        )}
      </div>
      <div className="bg-surface px-3 pt-2.5 pb-2">
        <Timeline
          durationMs={durationMs}
          utterances={utterances}
          participants={participants}
          chapters={chapters}
          highlights={highlights}
          clipRange={clipRange}
        />
        <div className="mt-2 flex items-center gap-1">
          <IconBtn label={playing ? "Pause (space)" : "Play (space)"} onClick={p.toggle}>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </IconBtn>
          <IconBtn label="Back 10s (J)" onClick={() => p.seek(p.getTime() - 10000, { play: playing })}>
            <RotateCcw size={15} />
          </IconBtn>
          <IconBtn label="Forward 10s (L)" onClick={() => p.seek(p.getTime() + 10000, { play: playing })}>
            <RotateCw size={15} />
          </IconBtn>
          <TimeReadout durationMs={clipRange ? clipRange.endMs : durationMs} />
          <div className="ml-auto flex items-center gap-1">
            {onHighlight && (
              <button
                onClick={onHighlight}
                className="mr-1 inline-flex h-7 items-center gap-1.5 rounded-lg bg-hl px-2.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-hl-strong/40"
                title="Highlight this moment (H)"
              >
                <Sparkles size={13} /> Highlight
              </button>
            )}
            <button onClick={cycleRate} className="h-7 min-w-[42px] rounded-lg px-1.5 text-[12.5px] font-semibold text-ink-2 tabular-nums hover:bg-sunken" title="Playback speed">
              {rate}×
            </button>
            <IconBtn label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </IconBtn>
            <IconBtn label="Fullscreen" onClick={() => p.videoRef.current?.requestFullscreen?.()}>
              <Maximize2 size={15} />
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-sunken hover:text-ink">
      {children}
    </button>
  );
}

function TimeReadout({ durationMs }: { durationMs: number }) {
  const t = useTime(1000);
  return (
    <span className="ml-1.5 font-mono text-[12px] text-ink-3 tabular-nums">
      <span className="text-ink-2">{clock(t)}</span> / {clock(durationMs)}
    </span>
  );
}

function Timeline({
  durationMs,
  utterances,
  participants,
  chapters,
  highlights,
  clipRange,
}: {
  durationMs: number;
  utterances: Utterance[];
  participants: Participant[];
  chapters: Chapter[];
  highlights: Highlight[];
  clipRange?: { startMs: number; endMs: number } | null;
}) {
  const p = usePlayer();
  const t = useTime(200);
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number } | null>(null);
  const color = new Map(participants.map((x) => [x.key, x.color]));
  const total = Math.max(durationMs, 1);
  const pctOf = (ms: number) => `${(ms / total) * 100}%`;

  const msAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total));
  };
  const hoverChapter = hover ? chapters[indexAt(chapters, hover.ms)] : null;
  const hoverUtt = hover ? utterances[indexAt(utterances, hover.ms)] : null;
  const hoverName = hoverUtt && hoverUtt.endMs >= hover!.ms ? participants.find((x) => x.key === hoverUtt.speaker)?.name : null;

  return (
    <div
      ref={bar}
      className="relative h-7 cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        p.seek(msAt(e.clientX), { play: !p.videoRef.current?.paused });
      }}
      onPointerMove={(e) => {
        const r = bar.current!.getBoundingClientRect();
        setHover({ x: e.clientX - r.left, ms: msAt(e.clientX) });
        if (e.buttons === 1) p.seek(msAt(e.clientX), { play: false });
      }}
      onPointerLeave={() => setHover(null)}
    >
      {/* speaker segments: who spoke when */}
      <div className="absolute inset-x-0 top-2.5 h-2.5 overflow-hidden rounded-full bg-sunken">
        {utterances.map((u) => (
          <div
            key={u.idx}
            className="absolute top-0 h-full opacity-70"
            style={{ left: pctOf(u.startMs), width: `max(1px, ${pctOf(u.endMs - u.startMs)})`, background: color.get(u.speaker) }}
          />
        ))}
        <div className="absolute inset-y-0 left-0 bg-white/55" style={{ left: pctOf(t), right: 0 }} />
      </div>
      {clipRange && (
        <div
          className="absolute top-1.5 h-4.5 rounded border-2 border-hl-strong"
          style={{ left: pctOf(clipRange.startMs), width: pctOf(clipRange.endMs - clipRange.startMs) }}
        />
      )}
      {chapters.slice(1).map((c) => (
        <div key={c.idx} className="absolute top-1.5 h-4.5 w-[2px] rounded bg-surface" style={{ left: pctOf(c.startMs) }} />
      ))}
      {highlights.map((h) => (
        <div
          key={h.id}
          className="absolute top-0 h-1.5 rounded-full bg-hl-strong"
          style={{ left: pctOf(h.startMs), width: `max(4px, ${pctOf(h.endMs - h.startMs)})` }}
          title={h.note || "Highlight"}
        />
      ))}
      <div className="absolute top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-ink shadow" style={{ left: pctOf(t) }} />
      {hover && (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-1.5 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-[11.5px] whitespace-nowrap text-white shadow-pop"
          style={{ left: Math.min(Math.max(hover.x, 60), (bar.current?.clientWidth ?? 0) - 60) }}
        >
          <span className="font-mono">{clock(hover.ms)}</span>
          {hoverName && <span className="text-white/70"> · {hoverName}</span>}
          {hoverChapter && <div className="max-w-[220px] truncate text-white/70">{hoverChapter.title}</div>}
        </div>
      )}
    </div>
  );
}
