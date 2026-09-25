"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Check, FlaskConical, Globe, Radio, Users, Video } from "lucide-react";
import type { CalendarEvent } from "@/lib/queries";
import { connectCalendar, disconnectCalendar, setAutoRecord } from "@/app/actions";
import { cn, dayLabel, timeLabel } from "@/lib/format";
import { Button, Logo } from "@/components/ui";
import { RecordSwitch, useEventRecord } from "./upcoming-strip";

type Cal = { connected: boolean; email: string | null; autoRecord: string; events: CalendarEvent[] };

const RULES = [
  { key: "all", label: "All meetings with a video link", hint: "Recommended" },
  { key: "external", label: "Only meetings with people outside my company", hint: "Sales & customer calls" },
  { key: "internal", label: "Only internal meetings", hint: "Team syncs & 1:1s" },
  { key: "none", label: "Don't join automatically", hint: "Turn it on per meeting" },
] as const;

const PLATFORM: Record<string, string> = { zoom: "Zoom", meet: "Google Meet", teams: "Microsoft Teams", none: "No video link" };

export function CalendarSettings({ calendar }: { calendar: Cal }) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [email, setEmail] = useState("you@acme.com");
  const [rule, setRule] = useState(calendar.autoRecord);
  const [pending, start] = useTransition();
  const { events, toggle } = useEventRecord(calendar.events);

  const days = new Map<string, CalendarEvent[]>();
  for (const e of events) days.set(dayLabel(e.startsAt), [...(days.get(dayLabel(e.startsAt)) ?? []), e]);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <FlaskConical size={17} className="mt-0.5 shrink-0" />
        <p>
          <b className="font-semibold">Simulated in this demo:</b> the calendar connection and the meeting bot. Joining a meeting replays a real recorded call as if it
          were happening live, so you can try highlighting mid-call. Everything after the call (transcripts, notes, search, sharing) is real.
        </p>
      </div>

      {!calendar.connected ? (
        <section className="rounded-xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <CalendarDays size={22} />
          </div>
          <h2 className="text-[16px] font-semibold">Connect your calendar</h2>
          <p className="mx-auto mt-1 mb-5 max-w-md text-[13.5px] text-ink-3">We only read events with a meeting link. Plumb never edits your calendar or invites anyone.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => setConnecting(true)}>
              <Globe size={15} /> Connect Google Calendar
            </Button>
            <Button onClick={() => setConnecting(true)}>
              <Globe size={15} /> Connect Outlook
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ok/10 text-ok">
                <Check size={16} />
              </span>
              <div className="flex-1">
                <p className="text-[13.5px] font-medium">Google Calendar connected</p>
                <p className="text-[12.5px] text-ink-3">{calendar.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => start(async () => { await disconnectCalendar(); router.refresh(); })}>
                Disconnect
              </Button>
            </div>
            <div className="px-5 py-4">
              <p className="mb-2.5 text-[13px] font-semibold">Which meetings should Plumb join?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {RULES.map((r) => (
                  <button
                    key={r.key}
                    disabled={pending}
                    onClick={() => {
                      setRule(r.key);
                      start(async () => {
                        await setAutoRecord(r.key);
                        router.refresh();
                      });
                    }}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      rule === r.key ? "border-accent bg-accent-soft/50" : "border-line hover:border-line-strong"
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", rule === r.key ? "border-accent" : "border-line-strong")}>
                      {rule === r.key && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium">{r.label}</span>
                      <span className="block text-[12px] text-ink-3">{r.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 px-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Upcoming meetings</h2>
            <div className="space-y-4">
              {[...days].map(([day, list]) => (
                <div key={day}>
                  <p className="mb-1.5 px-1 text-[13px] font-medium text-ink-2">{day}</p>
                  <div className="overflow-hidden rounded-xl border border-line bg-surface">
                    {list.map((e, i) => {
                      const noVideo = e.platform === "none";
                      return (
                        <div key={e.id} className={cn("flex items-center gap-4 px-4 py-3", i > 0 && "border-t border-line")}>
                          <div className="w-20 shrink-0 text-[12.5px] text-ink-3 tabular-nums">
                            {timeLabel(e.startsAt)}
                            <br />
                            {timeLabel(e.endsAt)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium">{e.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
                              <span className="flex items-center gap-1">
                                <Video size={12} /> {PLATFORM[e.platform] ?? e.platform}
                              </span>
                              {e.attendees.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users size={12} /> {e.attendees.slice(0, 3).join(", ")}
                                  {e.attendees.length > 3 && ` +${e.attendees.length - 3}`}
                                </span>
                              )}
                              {e.external && <span className="rounded bg-amber-50 px-1.5 font-medium text-amber-700">External</span>}
                            </p>
                          </div>
                          {e.replayOf && e.record && !noVideo && (
                            <Link
                              href={`/live/${e.id}`}
                              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-ink/85"
                            >
                              <Radio size={13} /> Join now
                            </Link>
                          )}
                          <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <RecordSwitch on={e.record && !noVideo} disabled={noVideo} onChange={(v) => toggle(e.id, v)} />
                            <span className="text-[10.5px] text-ink-3">{noVideo ? "n/a" : e.record ? "Record" : "Skip"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Dialog.Root open={connecting} onOpenChange={setConnecting}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 shadow-pop">
            <div className="mb-4 flex items-center justify-center gap-3">
              <Logo className="h-9 w-9" />
              <span className="text-ink-3">⇄</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line">
                <CalendarDays size={18} className="text-accent" />
              </span>
            </div>
            <Dialog.Title className="text-center text-[16px] font-semibold">Plumb wants to read your calendar</Dialog.Title>
            <Dialog.Description className="mt-1 text-center text-[13px] text-ink-3">
              Demo sign-in: nothing leaves this page. We&apos;ll load a sample week of meetings.
            </Dialog.Description>
            <ul className="my-4 space-y-1.5 text-[13px] text-ink-2">
              <li className="flex gap-2"><Check size={15} className="text-ok" /> See events that have a meeting link</li>
              <li className="flex gap-2"><Check size={15} className="text-ok" /> See guest lists to tell internal from external calls</li>
            </ul>
            <label className="text-[12px] font-medium text-ink-2">
              Calendar account
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line px-3 text-[13.5px] font-normal outline-none focus:border-accent" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConnecting(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await connectCalendar(email);
                    setConnecting(false);
                    router.refresh();
                  })
                }
              >
                Allow
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
