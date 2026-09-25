"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, CheckSquare, CornerDownLeft, Search, Sparkles, Upload, Video } from "lucide-react";
import type { SearchHit } from "@/lib/queries";
import { clock, shortDate } from "@/lib/format";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data: SearchHit[] = await res.json();
      if (id === seq.current) {
        setHits(data);
        setLoading(false);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={16} className="text-ink-3" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Search every meeting: what was said, action items, titles…"
                className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
              />
              {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" />}
            </div>
            <Command.List className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <Command.Group heading="Go to" className="text-[11.5px] font-medium text-ink-3 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {[
                    { label: "Meetings", href: "/", icon: Video },
                    { label: "Highlights", href: "/highlights", icon: Sparkles },
                    { label: "Calendar & recording", href: "/calendar", icon: CalendarDays },
                    { label: "Upload a recording", href: "/upload", icon: Upload },
                  ].map(({ label, href, icon: Icon }) => (
                    <Command.Item
                      key={href}
                      onSelect={() => go(href)}
                      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13.5px] text-ink data-[selected=true]:bg-sunken"
                    >
                      <Icon size={15} className="text-ink-3" /> {label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : (
                <>
                  {!loading && hits.length === 0 && (
                    <Command.Empty className="px-3 py-8 text-center text-[13px] text-ink-3">No matches for “{q.trim()}”.</Command.Empty>
                  )}
                  {hits.map((h, i) => (
                    <Command.Item
                      key={`${h.meetingId}-${h.kind}-${h.startMs}-${i}`}
                      value={`${i}`}
                      onSelect={() => go(`/meetings/${h.meetingId}${h.startMs != null ? `?t=${h.startMs}` : ""}`)}
                      className="flex cursor-pointer gap-3 rounded-lg px-2.5 py-2 data-[selected=true]:bg-sunken"
                    >
                      <span className="mt-0.5 text-ink-3">
                        {h.kind === "action" ? <CheckSquare size={15} /> : h.kind === "title" ? <Video size={15} /> : <Search size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[12px] text-ink-3">
                          <span className="truncate font-medium text-ink-2">{h.meetingTitle}</span>
                          <span>·</span>
                          <span className="shrink-0">{shortDate(h.startedAt)}</span>
                          {h.startMs != null && <span className="shrink-0 font-mono">{clock(h.startMs)}</span>}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-snug text-ink">
                          {h.speaker && <span className="font-medium">{h.speaker}: </span>}
                          <span dangerouslySetInnerHTML={{ __html: h.snippet }} />
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                  {hits.length > 0 && (
                    <Command.Item
                      value="all"
                      onSelect={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
                      className="mt-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-accent data-[selected=true]:bg-accent-soft"
                    >
                      <CornerDownLeft size={14} /> See all results for “{q.trim()}”
                    </Command.Item>
                  )}
                </>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
