"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, CircleDot, Radio } from "lucide-react";
import type { CalendarEvent } from "@/lib/queries";
import { setEventRecord } from "@/app/actions";
import { cn, dayLabel, timeLabel } from "@/lib/format";

type Cal = { connected: boolean; email: string | null; autoRecord: string; events: CalendarEvent[] };

export function RecordSwitch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        onChange(!on);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40",
        on ? "bg-accent" : "bg-line-strong"
      )}
      title={on ? "Plumb will join and record" : "Plumb will not join"}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function useEventRecord(initial: CalendarEvent[]) {
  const [events, setEvents] = useState(initial);
  const [, start] = useTransition();
  // Server-side changes (e.g. a new auto-record rule) arrive as fresh props after router.refresh().
  useEffect(() => setEvents(initial), [initial]);
  const toggle = (id: string, record: boolean) => {
    setEvents((evs) => evs.map((e) => (e.id === id ? { ...e, record } : e)));
    start(() => setEventRecord(id, record));
  };
  return { events, toggle };
}

export function UpcomingStrip({ calendar }: { calendar: Cal }) {
  const { events, toggle } = useEventRecord(calendar.events);

  if (!calendar.connected) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <CalendarDays size={20} />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Connect your calendar and Plumb joins your calls for you</p>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Zoom, Google Meet and Teams. You choose which meetings get recorded.
          </p>
        </div>
        <Link href="/calendar" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13.5px] font-medium text-white hover:bg-accent-strong">
          Connect calendar
        </Link>
      </div>
    );
  }

  const upcoming = events.filter((e) => new Date(e.endsAt) > new Date()).slice(0, 4);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Upcoming</h2>
        <Link href="/calendar" className="text-[12.5px] font-medium text-accent hover:underline">
          Recording settings
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {upcoming.map((e) => {
          const live = new Date(e.startsAt) <= new Date() && new Date(e.endsAt) > new Date();
          const noVideo = e.platform === "none";
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
              <div className="w-[68px] shrink-0 text-[12px] leading-tight text-ink-3">
                <div className="font-medium text-ink-2">{dayLabel(e.startsAt)}</div>
                <div className="tabular-nums">{timeLabel(e.startsAt)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {live && <CircleDot size={12} className="animate-pulse-dot shrink-0 text-danger" />}
                  <p className="truncate text-[13.5px] font-medium">{e.title}</p>
                </div>
                <p className="truncate text-[12px] text-ink-3">
                  {noVideo ? "No video link" : e.record ? "Plumb will record" : "Not recording"}
                  {e.external && " · external"}
                </p>
              </div>
              {e.replayOf && e.record && !noVideo ? (
                <Link
                  href={`/live/${e.id}`}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-ink px-2.5 text-[12px] font-medium text-white hover:bg-ink/85"
                  title="Simulate this meeting being recorded live"
                >
                  <Radio size={12} /> Join
                </Link>
              ) : null}
              <RecordSwitch on={e.record && !noVideo} disabled={noVideo} onChange={(v) => toggle(e.id, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
