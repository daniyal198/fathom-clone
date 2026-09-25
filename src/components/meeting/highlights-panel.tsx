"use client";

import { useState } from "react";
import { Minus, Play, Plus, Share2, Sparkles, Trash2 } from "lucide-react";
import type { Highlight, Participant, Utterance } from "@/lib/types";
import { deleteHighlight, shareHighlight, updateHighlight } from "@/app/actions";
import { clock, cn } from "@/lib/format";
import { Empty } from "@/components/ui";
import { usePlayer, useTime } from "./player-store";
import { ShareDialog } from "./share-dialog";

export function excerptFor(h: { startMs: number; endMs: number }, utts: Utterance[]) {
  return utts.filter((u) => u.endMs > h.startMs && u.startMs < h.endMs);
}

export function HighlightsPanel({
  highlights,
  setHighlights,
  utterances,
  participants,
  meetingTitle,
  focusId,
}: {
  highlights: Highlight[];
  setHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;
  utterances: Utterance[];
  participants: Participant[];
  meetingTitle: string;
  focusId: string | null;
}) {
  const p = usePlayer();
  const t = useTime(250);
  const [sharing, setSharing] = useState<Highlight | null>(null);
  const byKey = new Map(participants.map((x) => [x.key, x]));
  const sorted = [...highlights].sort((a, b) => a.startMs - b.startMs);

  const patch = (id: string, change: Partial<Highlight>) => {
    setHighlights((hs) => hs.map((h) => (h.id === id ? { ...h, ...change } : h)));
    updateHighlight(id, change);
  };

  if (!highlights.length) {
    return (
      <Empty icon={<Sparkles size={26} />} title="No highlights yet">
        Press <b className="font-medium text-ink-2">H</b> while watching, or select lines in the transcript, to clip a moment you can share.
      </Empty>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto px-3 py-3">
      <ul className="space-y-2.5">
        {sorted.map((h) => {
          const lines = excerptFor(h, utterances);
          const playing = t >= h.startMs && t <= h.endMs;
          return (
            <li
              key={h.id}
              className={cn(
                "group/h rounded-xl border bg-surface p-3 transition-colors",
                focusId === h.id ? "animate-fade-up border-hl-strong ring-2 ring-hl" : playing ? "border-accent/40" : "border-line"
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => p.playClip(h.startMs, h.endMs)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hl text-ink hover:bg-hl-strong/50"
                  aria-label="Play clip"
                >
                  <Play size={12} fill="currentColor" className="ml-0.5" />
                </button>
                <div className="flex items-center gap-1 font-mono text-[12px] text-ink-2 tabular-nums">
                  <Nudge onClick={() => patch(h.id, { startMs: Math.max(0, h.startMs - 5000) })} icon="minus" label="Start 5s earlier" />
                  {clock(h.startMs)}
                  <Nudge onClick={() => patch(h.id, { startMs: Math.min(h.endMs - 2000, h.startMs + 5000) })} icon="plus" label="Start 5s later" />
                  <span className="text-ink-3">–</span>
                  <Nudge onClick={() => patch(h.id, { endMs: Math.max(h.startMs + 2000, h.endMs - 5000) })} icon="minus" label="End 5s earlier" />
                  {clock(h.endMs)}
                  <Nudge onClick={() => patch(h.id, { endMs: h.endMs + 5000 })} icon="plus" label="End 5s later" />
                </div>
                {h.source === "live" && <span className="rounded-full bg-sunken px-1.5 text-[10.5px] font-medium text-ink-3">during call</span>}
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    onClick={() => setSharing(h)}
                    className={cn("inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium hover:bg-sunken", h.shareToken ? "text-ok" : "text-ink-2")}
                  >
                    <Share2 size={13} /> {h.shareToken ? "Shared" : "Share"}
                  </button>
                  <button
                    onClick={() => {
                      setHighlights((hs) => hs.filter((x) => x.id !== h.id));
                      deleteHighlight(h.id);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-danger"
                    aria-label="Delete highlight"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <textarea
                defaultValue={h.note}
                rows={1}
                autoFocus={focusId === h.id && !h.note}
                placeholder="What's this moment? Add a note…"
                onBlur={(e) => e.target.value !== h.note && patch(h.id, { note: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                className="mt-2 w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-[13.5px] leading-snug font-medium outline-none [field-sizing:content] placeholder:font-normal placeholder:text-ink-3 hover:bg-canvas focus:bg-canvas"
              />
              <div className="mt-1 line-clamp-3 border-l-2 border-hl-strong pl-2.5 text-[12.5px] leading-relaxed text-ink-2">
                {lines.map((u) => (
                  <span key={u.idx}>
                    <b className="font-medium text-ink">{byKey.get(u.speaker)?.name}:</b> {u.text}{" "}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <ShareDialog
        open={!!sharing}
        onOpenChange={(v) => !v && setSharing(null)}
        heading="Share this clip"
        blurb={sharing ? `${clock(sharing.startMs)}–${clock(sharing.endMs)} from “${meetingTitle}”. Viewers see only this moment and its transcript.` : ""}
        subject={`Clip from ${meetingTitle}`}
        getToken={async () => {
          const token = await shareHighlight(sharing!.id);
          setHighlights((hs) => hs.map((x) => (x.id === sharing!.id ? { ...x, shareToken: token } : x)));
          return token;
        }}
      />
    </div>
  );
}

function Nudge({ onClick, icon, label }: { onClick: () => void; icon: "plus" | "minus"; label: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="flex h-4 w-4 items-center justify-center rounded text-ink-3 opacity-0 group-hover/h:opacity-100 hover:bg-sunken hover:text-ink">
      {icon === "plus" ? <Plus size={10} /> : <Minus size={10} />}
    </button>
  );
}
