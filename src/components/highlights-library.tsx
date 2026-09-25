"use client";

import Link from "next/link";
import { useState } from "react";
import { Play, Share2, Sparkles } from "lucide-react";
import { shareHighlight } from "@/app/actions";
import { clock, dayLabel } from "@/lib/format";
import type { Highlight } from "@/lib/types";
import { Empty } from "@/components/ui";
import { ShareDialog } from "./meeting/share-dialog";

type Item = Highlight & { meetingTitle: string; meetingStartedAt: string; excerpt: string; speaker: string | null };

export function HighlightsLibrary({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [sharing, setSharing] = useState<Item | null>(null);
  if (!items.length) {
    return (
      <Empty icon={<Sparkles size={26} />} title="No highlights yet">
        Open a meeting and press H while it plays, or select lines in the transcript.
      </Empty>
    );
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((h) => (
          <article key={h.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-3">
              <span className="truncate font-medium text-ink-2">{h.meetingTitle}</span>
              <span>·</span>
              <span className="shrink-0">{dayLabel(h.meetingStartedAt)}</span>
            </div>
            <p className="text-[14px] leading-snug font-semibold">{h.note || "Untitled highlight"}</p>
            <p className="mt-2 line-clamp-3 flex-1 border-l-2 border-hl-strong pl-2.5 text-[12.5px] leading-relaxed text-ink-2">
              {h.speaker && <b className="font-medium text-ink">{h.speaker}: </b>}
              {h.excerpt}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Link
                href={`/meetings/${h.meetingId}?t=${h.startMs}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-hl px-2.5 text-[12px] font-medium hover:bg-hl-strong/40"
              >
                <Play size={11} fill="currentColor" /> {clock(h.startMs)}–{clock(h.endMs)}
              </Link>
              <button
                onClick={() => setSharing(h)}
                className={`ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium hover:bg-sunken ${h.shareToken ? "text-ok" : "text-ink-2"}`}
              >
                <Share2 size={13} /> {h.shareToken ? "Shared" : "Share"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <ShareDialog
        open={!!sharing}
        onOpenChange={(v) => !v && setSharing(null)}
        heading="Share this clip"
        blurb={sharing ? `${clock(sharing.startMs)}–${clock(sharing.endMs)} from “${sharing.meetingTitle}”` : ""}
        subject={sharing ? `Clip from ${sharing.meetingTitle}` : ""}
        getToken={async () => {
          const token = await shareHighlight(sharing!.id);
          setItems((xs) => xs.map((x) => (x.id === sharing!.id ? { ...x, shareToken: token } : x)));
          return token;
        }}
      />
    </>
  );
}
